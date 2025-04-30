import { client } from "../config/db.js";

const db_name = "Khalifa-Drug-House";

export const usersCollection = client.db(db_name).collection("users");
export const pharmaciesCollection = client.db(db_name).collection("pharmacies");
export const dosageFormsCollection = client
  .db(db_name)
  .collection("dosage-forms");
export const groupsCollection = client.db(db_name).collection("groups");
export const companiesCollection = client.db(db_name).collection("companies");
export const medicinesCollection = client.db(db_name).collection("medicines");
export const soldInvoicesCollection = client
  .db(db_name)
  .collection("sold-invoices");
export const purchaseCollection = client.db(db_name).collection("purchase");
export const expenseCollection = client.db(db_name).collection("expenses");
export const customerAndSupplierCollection = client
  .db(db_name)
  .collection("customerAndSupplier");
export const transactionCollection = client
  .db(db_name)
  .collection("transactions");
export const dueDepositCollection = client.db(db_name).collection("dueDeposit");
