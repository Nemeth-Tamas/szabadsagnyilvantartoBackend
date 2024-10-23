import { Client, Databases, Functions, Query, Users } from 'node-appwrite';

const isOnLeave = async (szabadsagok) => {
  if (szabadsagok != undefined) {
    let today = new Date();
    today = today.toISOString().split('T')[0];

    return szabadsagok.some(leave => leave.dates.includes(today));
  } else {
    return false;
  }
}

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

  // Validate the environment variables
  if (!dbId || !kerelmekId || !szabadsagID) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);
  const functions = new Functions(client);

  let managerId;
  let managerUser;
  let name;
  let dates;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.managerId || !body.name || !body.dates) {
      throw new Error("managerId|name|dates is missing in the request body.");
    }
    managerId = body.managerId;
    name = body.name;
    dates = body.dates;

    managerUser = await users.get(managerId);
  } catch (parseError) {
    error(`Failed to parse request body or missing managerId: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing managerId" });
  }

  let managersLeaves = await database.listDocuments(dbId, szabadsagID, [
    Query.equal("userId", managerId),
    Query.orderDesc("$createdAt"),
    Query.limit(1000)
  ]);

  let managerOnLeaveToday = await isOnLeave(managersLeaves.documents);

  if (managerOnLeaveToday) {
    let subject = "Kérelem érkezett";
    let text = `${name} a következő időpontokra kért szabadságot: ${dates.join(", ")}.\n\nKérem, hogy a kérelmet mielőbb vizsgálja át.`;
    functions.createExecution(
      process.env.APPWRITE_SEND_EMAIL_FUNCTION, // SendEmail function ID
      JSON.stringify({
        subject: subject,
        text: text
      })
    );
  }
};
