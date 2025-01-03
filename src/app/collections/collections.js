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
