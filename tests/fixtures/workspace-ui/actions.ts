export async function signOut() { throw new Error("Business/auth writes are forbidden in the isolated Workspace fixture"); }

export const createCustomer = signOut;
export const updateCustomer = signOut;
export const addCustomerContact = signOut;
export const deleteCustomerContact = signOut;
export const setPrimaryContact = signOut;
export const updateProduct = signOut;
export const approveQuote = signOut;
export const markQuoteReady = signOut;
export const returnQuoteToDraft = signOut;
export const sendQuoteEmail = signOut;
export const updateQuoteDelivery = signOut;
export const updateQuoteHeader = signOut;
export const updateQuoteLine = signOut;
export const createQuoteFromRfq = signOut;
export const confirmRfqMatch = signOut;
export const retryRfqProcessing = signOut;
export const createSalesOrderDraftAction = signOut;
export const acceptPurchaseOrderException = signOut;
export const acceptPurchaseOrderHeaderExceptions = signOut;
export const approvePurchaseOrderReconciliation = signOut;
export const linkPurchaseOrderQuote = signOut;
export const runPurchaseOrderReconciliation = signOut;
