//TODO:
//test/prod toggle
//error handling
//logging
//documentation
//code comments

function doPost(e) {
  logToSheet('A7', "received the doPost");  
  logToSheet('A9', e.postData.contents);
  
  processBookingStatusChange(JSON.parse(e.postData.contents));
  
  //return HtmlService.createHtmlOutput('<b>Hello, world!</b>' + msg);
}

function test(){
  var spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  var postDataContents = spreadsheet.getSheets()[0].getRange("A9").getValue(); 
  var contentsObj = JSON.parse(postDataContents);
  
  processBookingStatusChange(contentsObj);
}

function logToSheet(cell, data){
  var spreadsheet = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'));
  spreadsheet.getSheets()[0].getRange(cell).setValue(data); 
}


function processBookingStatusChange(jsonContents) {  
  logToSheet("A1", "working");
  logToSheet("A2", jsonContents.booking);  
  
  var customerDetails = getCheckfrontCustomerDetails(jsonContents);
  var bookingIds = fetchBookingIdsForCustomer(customerDetails.id);
  
  var bookingTotals = fetchBookingTotals(bookingIds);
    
  writeCustomerDataToEmma(customerDetails, bookingTotals);
    
  logToSheet("A6", bookingIds.toString());
}

function getCheckfrontCustomerDetails(jsonContents){
  var customerDetailsObj = {};
  customerDetailsObj.id = jsonContents.booking.customer.code;
  customerDetailsObj.name = jsonContents.booking.customer.name;
  customerDetailsObj.email = jsonContents.booking.customer.email;
  customerDetailsObj.city = jsonContents.booking.customer.city;
  customerDetailsObj.phone = jsonContents.booking.customer.phone;
  
  return customerDetailsObj;
}

function fetchBookingIdsForCustomer(customerId){  
  var params = getCheckfrontRequestParams();  
  var response = UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty('CHECKFRONT_URL') + "/customer/" + customerId, params);  
  var data = JSON.parse(response.getContentText());  
  var bookingIds = Object.keys(data.customer.bookings);
  
  return bookingIds;
}

function fetchBookingTotals(bookingIds){
  var bookingTotals = {"paid" : 0, "skus" : []};
  var allSkus = [];
  
  for(var i = 0; i < bookingIds.length; i++){
    var bookingInfo = fetchBookingSkusAndPaid(bookingIds[i]);
    bookingTotals.paid += parseFloat(bookingInfo.paid);
        
    for(var s = 0; s < bookingInfo.skus.length; s++){
      allSkus.push(bookingInfo.skus[s]);
    }
    //remove sku duplicates
    for(var s = 0; s < allSkus.length; s++){
      if(bookingTotals.skus.indexOf(allSkus[s]) === -1){
        bookingTotals.skus.push(allSkus[s]);
      }
    }    
  }
  
  return bookingTotals;
}





function fetchBookingSkusAndPaid(bookingId){
  var params = getCheckfrontRequestParams();  
  var response = UrlFetchApp.fetch(PropertiesService.getScriptProperties().getProperty('CHECKFRONT_URL') + "/booking/" + bookingId, params);  
  var data = JSON.parse(response.getContentText());  
  
  var skusAndPaidObj = {};
  skusAndPaidObj.skus = [];
  skusAndPaidObj.paid = 0;
  
  //only gather data about bookings with a status of PAID or PART (deposit)
  if(data.booking.status_id === "PAID" || data.booking.status_id === "PART"){
    skusAndPaidObj.paid = data.booking.amount_paid;
    
    for(var item in data.booking.items){
      skusAndPaidObj.skus.push(data.booking.items[item].sku);
    }
  }
  return skusAndPaidObj;
}

function writeCustomerDataToEmma(customerDetails, bookingTotals){

  var headers = {"Authorization" : "Basic " + Utilities.base64Encode(PropertiesService.getScriptProperties().getProperty('EMMA_AUTH_KEY') + ":" + PropertiesService.getScriptProperties().getProperty('EMMA_AUTH_PASS'))};
  
  var data = 
      {
        "email": customerDetails.email,
        "fields": {
          "full-name": customerDetails.name,
          "source": "checkfront integration JS",
          "city": customerDetails.city,
          "phone": customerDetails.phone,
          "checkfront-purchased-skus": bookingTotals.skus,
          "checkfront-paid": bookingTotals.paid
        }
      };

  var params = {
    "method":"POST",
    "headers":headers,
    "contentType": "application/json",
    "payload" : JSON.stringify(data)
  };  
  
  var response = UrlFetchApp.fetch("https://api.e2ma.net/" + PropertiesService.getScriptProperties().getProperty('EMMA_ACCOUNT_ID') + "/members/add", params); 
  
  var s = response.getResponseCode();
}




function getCheckfrontRequestParams(){
  var headers = {"Authorization" : "Basic " + Utilities.base64Encode(PropertiesService.getScriptProperties().getProperty('CHECKFRONT_AUTH_KEY') + ":" + PropertiesService.getScriptProperties().getProperty('CHECKFRONT_AUTH_PASS'))};
  var params = {
    "method":"GET",
    "headers":headers
  };  
  return params;
}







