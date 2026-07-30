class ApiResponse<T> {
  public readonly success = true;

  constructor(
    public statusCode: number,
    public data: T,
    public message = 'Success'
  ) {}
}

export default ApiResponse;