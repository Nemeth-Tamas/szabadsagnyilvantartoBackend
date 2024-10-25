import { Client, Databases, Users } from 'node-appwrite';

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
  let newUserName;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.userId || !body.newUserName) {
      throw new Error("submittingId|userId|newUserName is missing in the request body.");
    }
    submittingId = body.submittingId;
    userId = body.userId;
    newUserName = body.newUserName;

    submittingUser = await users.get(submittingId);

    if (!submittingUser.prefs.perms.includes("hr.edit_user_perms")) {
      error(`User ${submittingId} is not allowed to update user permissions.`);
      return res.json({ status: "fail", error: "You are not allowed to update user permissions." });
    }

    await users.updateName(userId, newUserName);

    let newUser = await users.get(userId);

    return res.json({ status: "success", newUser });
  } catch (parseError) {
    error(`Failed to parse request body or missing submittingId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing submittingId" });
  }
};
