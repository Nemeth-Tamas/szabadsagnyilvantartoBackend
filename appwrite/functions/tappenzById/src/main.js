import { Client, Databases, Query, Users } from 'node-appwrite';


export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const tappenzId = process.env.APPWRITE_TAPPENZ_COLLECTION;

  // Validate the environment variables
  if (!dbId || !tappenzId) {
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
    if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
      let tappenz = (await database.listDocuments(dbId, tappenzId, [
        Query.equal("userId", userId),
        Query.orderDesc("startDate"),
        Query.limit(5),
      ])).documents;

      return res.json({ status: "success", tappenz });
    } else {
      return res.json({ status: "fail", error: "Permission denied" });
    }
  } catch (err) {
    error(`Failed to get tappenz: ${err.message}`);
    return res.json({ status: "fail", error: "Failed to get tappenz" });
  }
};
