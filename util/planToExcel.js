const ExcelJS = require('exceljs');

const createExcel = (data, userName) => {
    return new Promise((resolve, reject) => {
        let workbook = new ExcelJS.Workbook();
        let worksheet = workbook.addWorksheet('Szabadság terv');
        
        // First row is userID
        worksheet.addRow([userName]);
        // Second row is months from january to december
        worksheet.addRow(["Január", "Február", "Március", "Április", "Május", "Junius", "Julius", "Augusztus", "Szeptember", "Október", "November", "December"]);
        
        // sort the dates into separate months
        let months = [];
        for (const element of data.dates) {
            let date = new Date(element);
            let month = date.getMonth();
            if (months[month] == undefined) {
                months[month] = [];
            }
            months[month].push(date);
        }
        
        // Initialize the row number
        let row = 3;
        
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
                worksheet.getCell(row, month + 1).value = currentDate.getDate();
        
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

        workbook.xlsx.writeBuffer().then((data) => {
            resolve(data);
        }).catch((error) => {
            reject(error);
        });
    });
};

module.exports = createExcel;