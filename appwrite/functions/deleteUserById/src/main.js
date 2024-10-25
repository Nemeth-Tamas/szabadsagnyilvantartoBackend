import { Client, Databases, Query, Users } from 'node-appwrite';

// This is your Appwrite function
// It's executed each time we get a request
export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const kerelmekId = process.env.APPWRITE_KERELMEK_COLLECTION;
  const szabadsagID = process.env.APPWRITE_SZABADSAG_COLLECTION;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const tappenzID = process.env.APPWRITE_TAPPENZ_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID || !kerelmekId || !szabadsagID || !tappenzID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingId;
  let submittingUser;
  let userId;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.userId) {
      throw new Error("submittingId|userId is missing in the request body.");
    }
    submittingId = body.submittingId;
    userId = body.userId;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    if (!submittingUser.prefs.perms.includes("jegyzo.delete_user")) {
      error("You are not allowed to delete users.");
      return res.json({ status: "fail", error: "You are not allowed to delete users." });
    }
    const user = await users.delete(userId);

    const requests = await database.listDocuments(dbId, kerelmekId, [
      Query.equal("submittingId", userId),
      Query.limit(1000)
    ]);
    for (let request of requests.documents) {
      await database.deleteDocument(dbId, kerelmekId, request.$id);
    }

    const szabadsagok = await database.listDocuments(dbId, szabadsagID, [
      Query.equal("userId", userId),
      Query.limit(1000)
    ]);

    for (let szabadsag of szabadsagok.documents) {
      await database.deleteDocument(dbId, szabadsagID, szabadsag.$id);
    }

    const plans = await database.listDocuments(dbId, plansID, [
      Query.equal("userId", userId),
      Query.limit(1000)
    ]);
    for (let plan of plans.documents) {
      await database.deleteDocument(dbId, plansID, plan.$id);
    }

    const tappenzek = await database.listDocuments(dbId, tappenzID, [
      Query.equal("userId", userId),
      Query.limit(1000)
    ]);
    for (let tappenz of tappenzek.documents) {
      await database.deleteDocument(dbId, tappenzID, tappenz.$id);
    }

    return res.json({ status: "success", user });
  } catch (err) {
    error(`Failed to delete user: ${err.message}`);
    return res.json({ status: "fail", err: "Failed to delete user" });
  }
};
