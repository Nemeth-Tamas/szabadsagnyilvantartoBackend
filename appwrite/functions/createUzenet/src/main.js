import { Client, Databases, ID, Users } from 'node-appwrite';

/**
 * Sends a message to a specific user by ID.
 * In body send submittingId, userId, message, and date.
 */
export default async ({ req, res, log, error }) => {
  const client = new Client();
  
  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const uzenetekId = process.env.APPWRITE_UZENETEK_COLLECTION;

  // Validate the environment variables
  if (!dbId || !uzenetekId) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);

  let submittingUserId;
  let submittingUser;
  let messageloc;
  let userId;
  let date;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.submittingId || !body.userId || !body.message || !body.date) {
      throw new Error("submittingId is missing in the request body.");
    }
    submittingUserId = body.submittingId;
    messageloc = body.message;
    userId = body.userId;
    date = body.date;

    submittingUser = await users.get(submittingUserId)
    if (submittingUser.prefs.perms.includes("irodavezeto.message_send")) {
      log(`Constructing message for user ID: ${submittingUserId}`);
      let data = {
        userId: userId,
        date: date,
        message: messageloc,
        sendingName: submittingUser.name,
      }

      const message = await database.createDocument(dbId, uzenetekId, ID.unique(), data);
      log(`Message created successfully: ${JSON.stringify(message)}`);
      return res.json({ status: "success", message });
    }
    else {
      error(`User ${submittingUserId} does not have permission to send messages`);
      return res.json({ status: "fail", error: "User does not have permission to send messages" });
    }
  } catch (parseError) {
    error(`Failed to parse request body or missing userId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing userId" });
  }
}
