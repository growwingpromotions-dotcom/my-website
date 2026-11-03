/**
 * ============================================================================
 * GROW WING - 100% Bulletproof Google Sheets Apps Script
 * Slogan: "YOUR BRAND, OUR CREATION"
 * ============================================================================
 * 
 * IF YOUR SCRIPT IS NOT WRITING TO THE SHEET, DO THIS ONE THING:
 * Paste your Google Sheet ID or full link between the quotes below:
 */
var SPREADSHEET_ID = "https://docs.google.com/spreadsheets/d/1mGCjAKVkVHryiUqhS-uWhmi0NcmK3fgmrFAm0PtgZ4M/edit?gid=0#gid=0"; // e.g. "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

function doPost(e) {
  try {
    var ss;
    // 1. Open spreadsheet by ID if provided, otherwise get the active one
    if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== "") {
      var cleanId = SPREADSHEET_ID.replace("https://docs.google.com/spreadsheets/d/", "").split("/")[0].trim();
      ss = SpreadsheetApp.openById(cleanId);
    } else {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }
    
    if (!ss) {
      throw new Error("Spreadsheet not found! Please paste your Google Sheet ID in SPREADSHEET_ID at line 9.");
    }
    
    var sheet = ss.getActiveSheet();
    
    // 2. Automatically create headers if the sheet is completely blank
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp",
        "Full Name",
        "Business Email",
        "Brand Name",
        "Service Needed",
        "Project Goals / Message"
      ]);
      
      var headerRange = sheet.getRange(1, 1, 1, 6);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#121316");
      headerRange.setFontColor("#FAF9F6");
      headerRange.setFontSize(11);
      sheet.setFrozenRows(1);
      sheet.setRowHeight(1, 35);
      sheet.setColumnWidth(1, 170);
      sheet.setColumnWidth(2, 180);
      sheet.setColumnWidth(3, 230);
      sheet.setColumnWidth(4, 180);
      sheet.setColumnWidth(5, 230);
      sheet.setColumnWidth(6, 320);
    }
    
    // 3. Extract submitted form data (handles both parameter and postData)
    var p = {};
    if (e && e.parameter && Object.keys(e.parameter).length > 0) {
      p = e.parameter;
    } else if (e && e.postData && e.postData.contents) {
      try {
        p = JSON.parse(e.postData.contents);
      } catch (err) {
        var pairs = e.postData.contents.split("&");
        for (var i = 0; i < pairs.length; i++) {
          var pair = pairs[i].split("=");
          p[decodeURIComponent(pair[0])] = decodeURIComponent((pair[1] || "").replace(/\+/g, " "));
        }
      }
    }
    
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT+5:30", "yyyy-MM-dd HH:mm:ss");
    var fullName = p.fullName || p.name || "N/A";
    var workEmail = p.workEmail || p.email || "N/A";
    var brandName = p.brandName || p.brand || "N/A";
    var serviceType = p.serviceType || p.service || "N/A";
    var projectNotes = p.projectNotes || p.notes || p.message || "N/A";
    
    // 4. Add the row to Google Sheets
    sheet.appendRow([
      timestamp,
      fullName,
      workEmail,
      brandName,
      serviceType,
      projectNotes
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Lead recorded in Google Sheets successfully!",
      row: sheet.getLastRow() 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: "error", 
      message: err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * TEST FUNCTION:
 * Click "testWrite" in the top bar and click "▶ Run".
 * If working, a test row will appear in your Google Sheet immediately!
 */
function testWrite() {
  var mockEvent = {
    parameter: {
      fullName: "Test Client",
      workEmail: "test@growwing.com",
      brandName: "GROW WING Brand",
      serviceType: "Social Media Marketing Agency",
      projectNotes: "This is a direct test row from Apps Script!"
    }
  };
  var result = doPost(mockEvent);
  Logger.log(result.getContent());
}

function doGet(e) {
  return ContentService.createTextOutput("GROW WING Google Sheets Web App is active and ready!");
}
