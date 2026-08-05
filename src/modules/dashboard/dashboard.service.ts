import { Asset, AssetStatus, AssetCategory } from '../asset/asset.model';
import {
  AssetAssignment,
  HardwareAssignment,
  LicenseAssignment,
  HardwareAssignmentStatus,
  LicenseAssignmentStatus,
} from '../asset-assignment/asset-assignment.model';
import { Employee, EmploymentStatus } from '../employee/employee.model';
import { Maintenance, MaintenanceStatus } from '../maintenance/maintenance.model';
import { SoftwareLicenseAsset } from '../asset/asset.model';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Builds an ordered list of { year, month, label } for the last N months, oldest first.
// Used to zero-fill months that have no DB records so chart data is always contiguous.
const buildMonthSlots = (months: number) => {
  const slots = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    slots.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
    });
  }
  return slots;
};

const startOfMonthsAgo = (months: number) =>
  new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);

// ---------------------------------------------------------------------------
// Stats — raw counts for headline KPI cards
// ---------------------------------------------------------------------------
export const getStats = async () => {
  const [
    assetStatusGroups,
    assetKindGroups,
    totalEmployees,
    activeEmployees,
    activeHardwareAssignments,
    activeLicenseSeats,
    openMaintenance,
  ] = await Promise.all([
    Asset.aggregate<{ _id: AssetStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Asset.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$assetKind', count: { $sum: 1 } } },
    ]),
    Employee.countDocuments(),
    Employee.countDocuments({ employmentStatus: EmploymentStatus.ACTIVE }),
    HardwareAssignment.countDocuments({ status: HardwareAssignmentStatus.ACTIVE }),
    LicenseAssignment.countDocuments({ status: LicenseAssignmentStatus.ACTIVE }),
    Maintenance.countDocuments({ status: MaintenanceStatus.OPEN }),
  ]);

  const byStatus = Object.values(AssetStatus).reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<AssetStatus, number>
  );
  let total = 0;
  for (const g of assetStatusGroups) {
    byStatus[g._id] = g.count;
    total += g.count;
  }

  const byKind = assetKindGroups.reduce(
    (acc, g) => ({ ...acc, [g._id]: g.count }),
    {} as Record<string, number>
  );

  return {
    assets: {
      total,
      byStatus,
      hardware: byKind['hardware'] ?? 0,
      softwareLicense: byKind['software_license'] ?? 0,
    },
    employees: { total: totalEmployees, active: activeEmployees },
    assignments: { activeHardware: activeHardwareAssignments, activeLicenseSeats },
    maintenance: { open: openMaintenance },
  };
};

// ---------------------------------------------------------------------------
// Charts — aggregated breakdowns for visualizations
// ---------------------------------------------------------------------------
export const getCharts = async (months = 6) => {
  const since = startOfMonthsAgo(months);
  const monthSlots = buildMonthSlots(months);

  const [
    byCategory,
    byStatus,
    assignmentTrendRaw,
    maintenanceCostRaw,
    topDepartmentsRaw,
  ] = await Promise.all([
    // Assets by category — pie/donut chart
    Asset.aggregate<{ _id: AssetCategory; count: number }>([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Assets by status — donut chart
    Asset.aggregate<{ _id: AssetStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // New assignments per month — bar/line chart
    AssetAssignment.aggregate<{ _id: { year: number; month: number }; count: number }>([
      { $match: { assignedDate: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: '$assignedDate' }, month: { $month: '$assignedDate' } },
          count: { $sum: 1 },
        },
      },
    ]),

    // Completed maintenance cost per month — bar/line chart
    Maintenance.aggregate<{ _id: { year: number; month: number }; totalCost: number }>([
      {
        $match: {
          status: MaintenanceStatus.COMPLETED,
          completedDate: { $gte: since },
          cost: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$completedDate' }, month: { $month: '$completedDate' } },
          totalCost: { $sum: '$cost' },
        },
      },
    ]),

    // Top 5 departments by active hardware assignments
    HardwareAssignment.aggregate<{ _id: string; count: number }>([
      { $match: { status: HardwareAssignmentStatus.ACTIVE } },
      { $lookup: { from: 'employees', localField: 'employee', foreignField: '_id', as: 'emp' } },
      { $unwind: '$emp' },
      { $group: { _id: '$emp.department', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  // Zero-fill months that had no data so the chart always has contiguous X-axis points
  const assignmentTrend = monthSlots.map((slot) => {
    const match = assignmentTrendRaw.find(
      (r) => r._id.year === slot.year && r._id.month === slot.month
    );
    return { month: slot.label, count: match?.count ?? 0 };
  });

  const maintenanceCostTrend = monthSlots.map((slot) => {
    const match = maintenanceCostRaw.find(
      (r) => r._id.year === slot.year && r._id.month === slot.month
    );
    return { month: slot.label, totalCost: match?.totalCost ?? 0 };
  });

  return {
    assetsByCategory: byCategory.map((g) => ({ category: g._id, count: g.count })),
    assetsByStatus: byStatus.map((g) => ({ status: g._id, count: g.count })),
    assignmentTrend,
    maintenanceCostTrend,
    topDepartmentsByAssignments: topDepartmentsRaw.map((g) => ({
      department: g._id,
      count: g.count,
    })),
  };
};

// ---------------------------------------------------------------------------
// KPIs — derived operational health indicators
// ---------------------------------------------------------------------------
export const getKPIs = async () => {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [
    assetStatusGroups,
    licenseCapacity,
    maintenanceCostAgg,
    warrantyExpiringSoon,
    assetsNeverAssigned,
  ] = await Promise.all([
    // Raw counts needed to compute utilization
    Asset.aggregate<{ _id: AssetStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    // Sum of totalSeats and seatsAllocated across all license assets
    SoftwareLicenseAsset.aggregate<{ totalSeats: number; seatsAllocated: number }>([
      {
        $group: {
          _id: null,
          totalSeats: { $sum: '$totalSeats' },
          seatsAllocated: { $sum: '$seatsAllocated' },
        },
      },
    ]),

    // Average + total cost of completed maintenance
    Maintenance.aggregate<{ avgCost: number; totalCost: number; count: number }>([
      { $match: { status: MaintenanceStatus.COMPLETED, cost: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: null,
          avgCost: { $avg: '$cost' },
          totalCost: { $sum: '$cost' },
          count: { $sum: 1 },
        },
      },
    ]),

    // Hardware assets with warranty expiring in the next 30 days
    Asset.countDocuments({
      assetKind: 'hardware',
      warrantyExpiryDate: { $gte: new Date(), $lte: thirtyDaysFromNow },
    }),

    // Available hardware assets that have never been assigned
    Asset.aggregate<{ count: number }>([
      { $match: { assetKind: 'hardware', status: AssetStatus.AVAILABLE } },
      {
        $lookup: {
          from: 'assetassignments',
          localField: '_id',
          foreignField: 'asset',
          as: 'history',
        },
      },
      { $match: { history: { $size: 0 } } },
      { $count: 'count' },
    ]),
  ]);

  // Asset utilization = assigned / (available + assigned)
  const statusMap = assetStatusGroups.reduce(
    (acc, g) => ({ ...acc, [g._id]: g.count }),
    {} as Record<string, number>
  );
  const assigned = statusMap[AssetStatus.ASSIGNED] ?? 0;
  const available = statusMap[AssetStatus.AVAILABLE] ?? 0;
  const assetUtilizationRate =
    available + assigned > 0
      ? parseFloat(((assigned / (available + assigned)) * 100).toFixed(1))
      : 0;

  // License seat utilization = seatsAllocated / totalSeats
  const licCap = licenseCapacity[0];
  const licenseUtilizationRate =
    licCap && licCap.totalSeats > 0
      ? parseFloat(((licCap.seatsAllocated / licCap.totalSeats) * 100).toFixed(1))
      : 0;

  const maintAgg = maintenanceCostAgg[0];

  return {
    assetUtilizationRate,
    licenseUtilizationRate,
    avgMaintenanceCost: maintAgg ? parseFloat(maintAgg.avgCost.toFixed(2)) : 0,
    totalMaintenanceCost: maintAgg?.totalCost ?? 0,
    assetsUnderService:
      (statusMap[AssetStatus.UNDER_MAINTENANCE] ?? 0) + (statusMap[AssetStatus.IN_REPAIR] ?? 0),
    warrantyExpiringSoon,
    assetsNeverAssigned: assetsNeverAssigned[0]?.count ?? 0,
  };
};
