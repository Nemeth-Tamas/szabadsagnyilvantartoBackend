import { Client, Databases, Functions, Query, Users } from 'node-appwrite';

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const resetById = process.env.APPWRITE_FUNCTION_RESET_PLAN_BY_ID;

  // Validate the environment variables
  if (!dbId || !plansID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);
  const functions = new Functions(client);

  let submittingId;
  let submittingUser;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId) {
      throw new Error("submittingId is missing in the request body.");
    }
    submittingId = body.submittingId;

    submittingUser = await users.get(submittingId);
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }

  try {
    if (submittingUser.prefs.perms.includes("hr.edit_user_current_state") && (new Date().getMonth() == 0)) {
      let users = await database.listDocuments(dbId, plansID, [
        Query.limit(1000)
      ]);
      for (const element of users.documents) {
        let uId = element.userId;
        functions.createExecution(resetById, JSON.stringify({
          userId: uId
        }));
      }
      return res.json({ status: "success" });
    } else {
      error("User does not have permission to reset plans.");
      return res.json({ status: "fail", error: "User does not have permission to reset plans" });
    }
  } catch (error) {
    error(`Failed to reset plans: ${error.message}`);
    return res.json({ status: "fail", error: "Failed to reset plans" });
  }
};
