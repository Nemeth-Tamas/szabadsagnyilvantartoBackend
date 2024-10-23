import { Client, Databases, ID, InputFile, Query, Storage, Users } from 'node-appwrite';
import * as xlsx from 'xlsx';

export default async ({ req, res, log, error }) => {
  const client = new Client();

  // Initialize the client and set the endpoint, project, and API key
  client
    .setEndpoint(process.env.APPWRITE_API_ENDPOINT) // Docker internal DNS to connect Appwrite
    .setProject(process.env.APPWRITE_PROJECT_ID)
    .setKey(process.env.APPWRITE_API_KEY);

  const dbId = process.env.APPWRITE_DB_ID;
  const plansID = process.env.APPWRITE_PLANS_COLLECTION;
  const downloadsBucket = process.env.APPWRITE_DOWNLOADS_BUCKET;

  // Validate the environment variables
  if (!dbId || !plansID || !downloadsBucket) {
    error("Database or collection ID is missing in environment variables.");
    return res.json({ status: "fail", error: "Server configuration error" });
  }

  const database = new Databases(client);
  const users = new Users(client);
  const storage = new Storage(client);

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
    let user = await users.get(userId);
    if (submittingUser.prefs.perms.includes("hr.edit_user_current_state")) {
      log(`User ${submittingUser.name} is getting plan for user ${user.name}.`);
      let doc = (await database.listDocuments(dbId, plansID, [
        Query.equal("userId", userId)
      ]))?.documents[0];

      log(`Found plan for user ${user.name}.`);
      if (doc == undefined) {
        log(`Creating plan for user ${user.name}.`);
        doc = await database.createDocument(dbId, plansID, ID.unique(), {
          userId: userId,
          managerId: user.prefs.manager,
          dates: [],
          filledOut: false
        });
      }

      log(`Starting to create the Excel file for user ${user.name}.`);
      let workbook = xlsx.utils.book_new();
      let worksheet = xlsx.utils.aoa_to_sheet([]); // Create an empty worksheet

      log(`Adding data to the Excel file for user ${user.name}.`);
      // First row is userID
      xlsx.utils.sheet_add_aoa(worksheet, [[user.name]], { origin: "A1" });
      // Second row is months from January to December
      xlsx.utils.sheet_add_aoa(worksheet, [["Január", "Február", "Március", "Április", "Május", "Junius", "Julius", "Augusztus", "Szeptember", "Október", "November", "December"]], { origin: "A2" });

      log(`Adding dates to the Excel file for user ${user.name}.`);
      // Sort the dates into separate months
      let months = [];
      for (const element of doc.dates) {
        let date = new Date(element);
        let month = date.getMonth();
        if (months[month] == undefined) {
          months[month] = [];
        }
        months[month].push(date);
      }

      // Initialize the row number
      let row = 3;

      log(`Iterating over the months for user ${user.name}.`);
      // Iterate over the months array
      for (let month = 0; month < months.length; month++) {
        if (months[month] == undefined) {
          continue;
        }
        // Create a new array to store the dates of the month
        let dates = months[month];

        // Sort the dates in ascending order
        dates.sort((a, b) => a - b);

        // Iterate over the sorted dates
        for (let i = 0; i < dates.length; i++) {
          // Get the current date and the next date
          let currentDate = dates[i];
          let nextDate = dates[i + 1];

          // Add the current date to the worksheet in the column of the current month
          let cellAddress = xlsx.utils.encode_cell({ r: row - 1, c: month });
          log(`Adding date ${currentDate} to the Excel file for user ${user.name}.`);
          log(`Cell address: ${cellAddress}`);
          // worksheet[cellAddress] = { t: 'n', v: currentDate.getDate() };
          xlsx.utils.sheet_add_aoa(worksheet, [[currentDate.getDate()]], { origin: cellAddress });

          // Increment the row number
          row++;

          // If the next date is not the next day, add an empty cell after the current date
          if (nextDate && (nextDate.getDate() - currentDate.getDate() > 1)) {
            // Increment the row number to add a cell skip
            row++;
          }
        }

        // Reset the row number for the next month
        row = 3;
      }

      // Add the worksheet to the workbook
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Szabadság terv');

      log(`Writing the Excel file for user ${user.name}.`);
      
      const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx', Props: { Author: "Szabadságnyilvántartó", Title: "Szabadság terv" } });

      log(`Uploading the Excel file for user ${user.name}.`);

      let file = await storage.createFile(downloadsBucket, ID.unique(), InputFile.fromBuffer(buffer, "Szabadság-Terv-" + user.name.replace(" ", "-") + "-" + (new Date()).toISOString().split("T")[0] + ".xlsx"))
      log(`Successfully uploaded the Excel file for user ${user.name} with ID ${file.$id}.`);
      
      return res.json({ status: "success", fileId: file.$id });
    } else {
      error("User does not have permission to get plan.");
      return res.json({ status: "fail", error: "User does not have permission to get plan" });
    }
  } catch (err) {
    error(`Failed to get plan by ID: ${err.message}`);
    return res.json({ status: "fail", err: "Failed to get plan by ID" });
  }
};
