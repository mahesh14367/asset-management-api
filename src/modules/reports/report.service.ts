import { Response } from 'express';
import { Asset } from '../asset/asset.model';
import {
  AssetAssignment,
  HardwareAssignment,
  LicenseAssignment,
  HardwareAssignmentStatus,
  LicenseAssignmentStatus,
} from '../asset-assignment/asset-assignment.model';
import { Maintenance } from '../maintenance/maintenance.model';
import { IUser } from '../user/user.model';
import { createAuditLog, buildActorSnapshot, AuditAction } from '../audit-log';
import { AuditMetadata } from '../audit-log/audit-log.model';
import {
  ReportType,
  ReportFormat,
  ReportFilters,
  GenerateReportParams,
  DataRow,
  ReportMeta,
  COLUMNS,
  REPORT_TITLES,
  formatDate,
  buildFiltersDisplay,
  buildFilename,
  streamCSV,
  streamXLSX,
  streamPDF,
  calcDurationDays,
} from './report.helper';

// Re-export public types so validation, controller, and index.ts need no changes
export type { ReportFilters, GenerateReportParams };
export { ReportType, ReportFormat };

type Actor = Pick<IUser, '_id' | 'name' | 'email' | 'role'>;

// ---------------------------------------------------------------------------
// Data fetchers â€” each returns DataRow[] matching the column order in COLUMNS
// ---------------------------------------------------------------------------

const fetchAssetInventory = async (f: ReportFilters): Promise<DataRow[]> => {
  const filter: Record<string, any> = {};
  if (f.status)   filter.status = f.status;
  if (f.category) filter.category = f.category;
  if (f.startDate || f.endDate) {
    filter.createdAt = {};
    if (f.startDate) filter.createdAt.$gte = f.startDate;
    if (f.endDate)   filter.createdAt.$lte = f.endDate;
  }

  const assets = await Asset.find(filter).sort({ assetTag: 1 }).lean() as any[];

  return assets.map(a => [
    a.assetTag,
    a.assetKind,
    a.category,
    a.name,
    a.brand ?? '',
    a.status,
    a.location ?? '',
    a.purchasePrice ?? null,
    formatDate(a.warrantyExpiryDate),
    a.assetKind === 'hardware' ? (a.condition ?? '') : 'N/A',
  ]);
};

const fetchAssetAssignments = async (f: ReportFilters): Promise<DataRow[]> => {
  const filter: Record<string, any> = {};
  if (f.status) filter.status = f.status;
  if (f.startDate || f.endDate) {
    filter.assignedDate = {};
    if (f.startDate) filter.assignedDate.$gte = f.startDate;
    if (f.endDate)   filter.assignedDate.$lte = f.endDate;
  }

  const assignments = await AssetAssignment.find(filter)
    .populate('asset', 'assetTag name')
    .populate('employee', 'employeeCode firstName lastName department')
    .sort({ assignedDate: -1 })
    .lean() as any[];

  return assignments.map(a => [
    a.asset?.assetTag ?? '',
    a.asset?.name ?? '',
    a.employee?.employeeCode ?? '',
    `${a.employee?.firstName ?? ''} ${a.employee?.lastName ?? ''}`.trim(),
    a.employee?.department ?? '',
    formatDate(a.assignedDate),
    formatDate(a.expectedReturnDate),
    a.status,
    a.conditionAtAssignment ?? 'N/A',
  ]);
};

const fetchMaintenanceLog = async (f: ReportFilters): Promise<DataRow[]> => {
  const filter: Record<string, any> = {};
  if (f.status) filter.status = f.status;
  if (f.startDate || f.endDate) {
    filter.startedDate = {};
    if (f.startDate) filter.startedDate.$gte = f.startDate;
    if (f.endDate)   filter.startedDate.$lte = f.endDate;
  }

  const records = await Maintenance.find(filter)
    .populate('asset', 'assetTag name')
    .sort({ startedDate: -1 })
    .lean() as any[];

  return records.map(r => [
    r.asset?.assetTag ?? '',
    r.asset?.name ?? '',
    r.type,
    r.status,
    r.vendor ?? '',
    r.cost ?? null,
    formatDate(r.startedDate),
    formatDate(r.completedDate),
    calcDurationDays(r.startedDate, r.completedDate),
    (r.description ?? '').slice(0, 100),
  ]);
};

// `employee_assets` always reflects current active state â€” date/category filters not applied
const fetchEmployeeAssets = async (_f: ReportFilters): Promise<DataRow[]> => {
  const [hw, lc] = await Promise.all([
    HardwareAssignment.find({ status: HardwareAssignmentStatus.ACTIVE })
      .populate('asset', 'assetTag name category assetKind')
      .populate('employee', 'employeeCode firstName lastName department')
      .lean() as Promise<any[]>,
    LicenseAssignment.find({ status: LicenseAssignmentStatus.ACTIVE })
      .populate('asset', 'assetTag name category assetKind')
      .populate('employee', 'employeeCode firstName lastName department')
      .lean() as Promise<any[]>,
  ]);

  return [...hw, ...lc]
    .sort((a, b) =>
      `${a.employee?.lastName}${a.employee?.firstName}`.localeCompare(
        `${b.employee?.lastName}${b.employee?.firstName}`
      )
    )
    .map(a => [
      a.employee?.employeeCode ?? '',
      `${a.employee?.firstName ?? ''} ${a.employee?.lastName ?? ''}`.trim(),
      a.employee?.department ?? '',
      a.asset?.assetTag ?? '',
      a.asset?.name ?? '',
      a.asset?.category ?? '',
      a.asset?.assetKind ?? '',
      formatDate(a.assignedDate),
      formatDate(a.expectedReturnDate),
      a.status,
    ]);
};

const FETCHERS: Record<ReportType, (f: ReportFilters) => Promise<DataRow[]>> = {
  [ReportType.ASSET_INVENTORY]:   fetchAssetInventory,
  [ReportType.ASSET_ASSIGNMENTS]: fetchAssetAssignments,
  [ReportType.MAINTENANCE_LOG]:   fetchMaintenanceLog,
  [ReportType.EMPLOYEE_ASSETS]:   fetchEmployeeAssets,
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const generateReport = async (
  params: GenerateReportParams,
  actor: Actor,
  metadata: AuditMetadata,
  res: Response
): Promise<void> => {
  const filters: ReportFilters = {
    startDate: params.startDate,
    endDate:   params.endDate,
    status:    params.status,
    category:  params.category,
  };

  const rows    = await FETCHERS[params.type](filters);
  const columns = COLUMNS[params.type];

  const meta: ReportMeta = {
    title:          REPORT_TITLES[params.type],
    type:           params.type,
    generatedAt:    new Date(),
    generatedBy:    `${actor.name} (${actor.email})`,
    totalRecords:   rows.length,
    filtersDisplay: buildFiltersDisplay(filters),
  };

  switch (params.format) {
    case ReportFormat.CSV:  streamCSV(columns, rows, meta, res);        break;
    case ReportFormat.XLSX: await streamXLSX(columns, rows, meta, res); break;
    case ReportFormat.PDF:  streamPDF(columns, rows, meta, res);        break;
  }

  await createAuditLog({
    actor: buildActorSnapshot(actor),
    action: AuditAction.REPORT_DOWNLOADED,
    entityType: 'Report',
    description: `Downloaded ${params.type} report as ${params.format.toUpperCase()}. ${rows.length} records.`,
    metadata,
  });
};

