export async function signOut() { throw new Error("Business/auth writes are forbidden in the isolated Workspace fixture"); }

export const createCustomer = signOut;
