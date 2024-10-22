import { Client, Databases, ID, Query, Users } from 'node-appwrite';

/**
 * Starts a new tappenz for a userId
 * body.submittingId: string
 * body.userId: string
 * body.start: string
 */
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
  let start;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.userId || !body.start) {
      throw new Error("submittingId|userId|start is missing in the request body.");
    }
    submittingId = body.submittingId;
    userId = body.userId;
    start = body.start;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  // checking perms
  try {
    if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
      let userInQuestion = await users.get(userId);
      if (userInQuestion == undefined) 
        return res.json({ status: "fail", error: "User not found" });
      let tappenz = await database.createDocument(dbId, tappenzId, ID.unique(), {
        userId: userId,
        managerId: userInQuestion.prefs.manager,
        startDate: start,
        endDate: null,
      });
      return res.json({ status: "success", tappenz });
    }
    else {
      return res.json({ status: "fail", error: "You do not have permission to start a tappenz" });
    }
  } catch (err) {
    error(`Error creating tappenz: ${err.message}`);
    return res.json({ status: "fail", error: err.message || "Unknown error" });
  }
};
