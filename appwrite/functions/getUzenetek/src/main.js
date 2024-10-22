import { Client, Databases, Query } from 'node-appwrite';

/**
 * Gets a list of messages for a specific user by ID
 * specified in the request body (userId).
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

  log(`Fetching messages for user ID: ${userId}`);

  try {
    // Ensure userId is passed as an array to Query.equal
    const messages = await database.listDocuments(dbId, uzenetekId, [
      Query.equal("userId", [userId]),  // userId wrapped in an array
      Query.orderDesc("$createdAt")
    ]);
    
    log(`Messages retrieved successfully: ${JSON.stringify(messages)}`);
    return res.json({ status: "success", messages });
  } catch (err) {
    error(`Error fetching messages: ${err.message}`);
    return res.json({ status: "fail", error: err.message || "Unknown error" });
  }
};
