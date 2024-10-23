import { Client, Databases, ID, Query, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;

  // Validate the environment variables
  if (!dbId || !plansID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let userId;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.userId) {
      throw new Error("userId is missing in the request body.");
    }
    userId = body.userId;
  } catch (parseError) {
    error(`Failed to parse request body or missing userId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing userId" });
  }

  try {
    let doc = (await database.listDocuments(dbId, plansID, [
      Query.equal("userId", userId)
    ]))?.documents[0];

    if (doc == undefined) {
      let userFromId = await users.get(userId);
      if (userFromId != undefined) {
        let planDoc = await database.createDocument(dbId, plansID, ID.unique(), {
          userId: userId,
          managerId: userFromId.prefs.manager,
          dates: [],
          filledOut: false
        });
        return res.json({ status: "success", planDoc });
      } else {
        error("User does not exist.");
        return res.json({ status: "fail", error: "User does not exist" });
      }
    } else {
      let docId = doc.$id;
      let planDoc = await database.updateDocument(dbId, plansID, docId, {
        dates: [],
        filledOut: false
      });
      return res.json({ status: "success", planDoc });
    }
  } catch (err) {
    error(`Failed to reset plan: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to reset plan" });
  }
};
