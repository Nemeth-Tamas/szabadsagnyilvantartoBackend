import { Client, Databases, Functions, Users } from 'node-appwrite';

// this is the actual one the frontend will be calling
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
  if (!dbId || !plansID || !resetById) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);
  const functions = new Functions(client);

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
      functions.createExecution(resetById, JSON.stringify({
        userId: userId
      })).then(() => {
        return res.json({ status: "success" });
      })
      .catch((err) => {
        error(`Failed to reset plan: ${err.message}`);
        return res.json({ status: "fail", error: "Failed to reset plan" });
      });
    } else {
      error("User does not have permission to reset plan.");
      return res.json({ status: "fail", error: "User does not have permission to reset plan" });
    }
  } catch (error) {
    error(`Failed to reset plan: ${error.message}`);
    return res.json({ status: "fail", error: "Failed to reset plan" });
  }
};
