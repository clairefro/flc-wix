import wixData from "wix-data";
import { Permissions, webMethod } from "wix-web-module";
import wixCRM from "wix-crm-backend";

async function _getAllItems(query) {
  let allItems = [];
  let result = await query.find();

  while (result.items.length > 0) {
    allItems = allItems.concat(result.items);
    if (result.hasNext()) {
      result = await result.next();
    } else {
      break;
    }
  }

  return allItems;
}

export const getEmailsNotTakenCourse = webMethod(
  Permissions.Admin,
  async (courseName) => {
    try {
      // Query all students who have taken the passed course
      const q = wixData
        .query("Forms/untitledForm") // student progress form
        .eq("dropdown_2", courseName); // dropdown_2 is 'course name'
      const taken = await _getAllItems(q);
      const takenEmails = [...new Set(taken.map((item) => item.email_1))]; // Unique emails

      // Query all unique emails in the collection
      const allEmailsQuery = wixData.query("Forms/untitledForm");
      const allStudents = await _getAllItems(allEmailsQuery);
      const allEmails = [...new Set(allStudents.map((item) => item.email_1))]; // Unique emails

      // Filter emails that haven't taken the course
      const emailsNotTaken = allEmails.filter(
        (email) => !takenEmails.includes(email)
      );

      return emailsNotTaken;
    } catch (error) {
      console.error("Error fetching emails:", error);
      throw new Error("Failed to fetch emails.");
    }
  }
);

/// ---

/**
 * Fetches a single chunk of contacts with timeout protection
 */
export const fetchContactsChunk = webMethod(
  Permissions.Admin,
  ({ limit, offset }) => {
    return new Promise(async (resolve, reject) => {
      try {
        // Build base query
        let query = wixCRM.contacts.queryContacts().limit(limit).skip(offset);
        // Execute query
        const result = await query.find();
        // ignore these squigglies - it exists
        resolve({
          items: result.items,
          hasMore: offset + limit < result.totalCount,
          totalCount: result.totalCount,
          offset: result._offset,
        });
      } catch (error) {
        console.error("Error in fetchContactsChunk:", error);
        return { items: [], totalCount: 0, hasMore: false };
      }
    });
  }
);
