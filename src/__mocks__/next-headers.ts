export const cookies = jest.fn().mockResolvedValue({
  get: jest.fn().mockReturnValue({ value: "mock-jwt-token" }),
  set: jest.fn(),
  delete: jest.fn(),
});
