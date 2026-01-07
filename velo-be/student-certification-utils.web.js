import wixData from "wix-data";
import { Permissions, webMethod } from "wix-web-module";
import { currentMember } from "wix-members-backend";

// Helper function to map verbose categories from form data into more concise labels
function _mapCategory(cat) {
  const catMap = {
    "Core curriculum (Levels 1 -10)": "Core curriculum",
    "Anatomy and Physiology": "Anatomy and Physiology",
    Elective: "Elective",
    Practice: "Practice",
    Other: "Other",
  };
  return catMap[cat] || "Unknown";
}

// Helper function to map raw item data into table headers
function _mapItem(rawItem) {
  return {
    date_completed: rawItem.date_1,
    hours: rawItem.number_1,
    school: rawItem.text_3,
    instructor: rawItem.text_2,
    course_name: rawItem.text_1,
    course: rawItem.dropdown_2,
    category: _mapCategory(rawItem.dropdown_1),
    link: rawItem.url_1,
    note: rawItem.text_5,
  };
}

// Shared function to fetch data based on an email

async function _fetchDataByEmail(email) {
  try {
    let results = [];
    let queryResults = await wixData
      .query("Forms/untitledForm") // student progress form
      .eq("email_1", email) // Filter by email
      .ascending("date_1", "dropdown_1", "dropdown_2") // Sort by date and requirement type and course
      .limit(50) // Limit to 50 results per page
      .find({ suppressAuth: true }); // Bypass private collection auth

    // Add the current page's results to the array
    results = results.concat(queryResults.items.map((item) => _mapItem(item)));

    // Continue fetching results as long as there are more pages
    while (queryResults.hasNext()) {
      queryResults = await queryResults.next(); // Fetch the next set of results
      results = results.concat(
        queryResults.items.map((item) => _mapItem(item))
      ); // Add the next page's results
    }

    return results.sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;

      if (a.course < b.course) return -1;
      if (a.course > b.course) return 1;

      return 0;
    });
  } catch (err) {
    console.error("Failed to fetch data by email:", err);
    throw new Error("Could not fetch data by email");
  }
}

async function getCurrentMemberEmail() {
  const member = await currentMember.getMember({ fieldsets: ["FULL"] });
  return member?.loginEmail;
}

// EXPORTS ========================================================

// FETCH DATA - FOR SITE MEMBERS (can only get own data)
export const getStudentCertDataCurrentUser = webMethod(
  Permissions.SiteMember,
  async () => {
    try {
      const email = await getCurrentMemberEmail();
      const items = await _fetchDataByEmail(email);
      return items;
    } catch (err) {
      console.error(err);
      throw new Error("Data retrieval failed");
    }
  }
);

// FETCH DATA - FOR SITE MEMBERS (can get data for any email)
export const getStudentCertDataAdmin = webMethod(
  Permissions.Admin,
  async (email) => {
    try {
      const items = await _fetchDataByEmail(email);
      return items;
    } catch (err) {
      console.error(err);
      throw new Error("Data retrieval failed: " + err.message);
    }
  }
);

export const getUniqueStudentInfoAdmin = webMethod(
  Permissions.Admin,
  async () => {
    try {
      let results = [];

      // Loop to handle pagination
      let queryResults = await wixData
        .query("Forms/untitledForm")
        .ascending("email_1")
        .limit(50) // Limit to 50 results per page
        .find();

      results = results.concat(queryResults.items); // Add the current page's results to the array

      // Continue fetching results as long as there are more pages
      while (queryResults.hasNext()) {
        queryResults = await queryResults.next(); // Fetch the next page of results
        results = results.concat(queryResults.items); // Add the next page's results
      }

      // Create a map to store unique students based on email
      const uniqueStudentsMap = new Map();

      results.forEach((item) => {
        if (!uniqueStudentsMap.has(item.email_1)) {
          uniqueStudentsMap.set(item.email_1, {
            email: item.email_1,
            firstName: item.firstName_1 || "",
            lastName: item.lastName_1 || "",
          });
        }
      });

      // Convert the map values into an array and sort them by firstName and lastName
      const uniqueStudentsArray = Array.from(uniqueStudentsMap.values());

      // Sort by firstName and lastName in alphabetical order
      uniqueStudentsArray.sort((a, b) => {
        const fullNameA = (a.firstName + " " + a.lastName).toLowerCase();
        const fullNameB = (b.firstName + " " + b.lastName).toLowerCase();

        if (fullNameA < fullNameB) return -1;
        if (fullNameA > fullNameB) return 1;
        return 0; // Names are equal
      });

      // Return the sorted array of unique students
      return uniqueStudentsArray;
    } catch (err) {
      console.error("Failed to retrieve unique student info:", err);
      throw new Error("Could not retrieve unique student info");
    }
  }
);

export const buildProgressSummary = webMethod(Permissions.Anyone, (items) => {
  // Category limits (required hours per category)
  const requiredHoursByCategory = {
    "Core curriculum": 200,
    "Anatomy and Physiology": 100,
    Electives: 50,
    Practice: 100,
    Other: 50,
  };

  const requiredHoursTotal = Object.values(requiredHoursByCategory).reduce(
    (total, hours) => total + hours,
    0
  );

  // Initialize total variables for both completed hours and total required hours
  let totalCore = 0,
    totalAnatomy = 0,
    totalElectives = 0,
    totalPractice = 0,
    totalOther = 0,
    totalActualHours = 0;

  // Loop over the array to accumulate actual hours by category
  items.forEach((item) => {
    switch (item.category) {
      case "Core curriculum":
        totalCore += item.hours;
        break;
      case "Anatomy and Physiology":
        totalAnatomy += item.hours;
        break;
      case "Elective":
        totalElectives += item.hours;
        break;
      case "Practice":
        totalPractice += item.hours;
        break;
      case "Other":
        totalOther += item.hours;
        break;
      default:
        break;
    }
    totalActualHours += item.hours; // Accumulate the total actual hours
  });

  // Calculate the percentage for each category (based on required hours, can exceed 100%)
  const corePercentage =
    (totalCore / requiredHoursByCategory["Core curriculum"]) * 100;
  const anatomyPercentage =
    (totalAnatomy / requiredHoursByCategory["Anatomy and Physiology"]) * 100;
  const electivesPercentage =
    (totalElectives / requiredHoursByCategory["Electives"]) * 100;
  const practicePercentage =
    (totalPractice / requiredHoursByCategory["Practice"]) * 100;
  const otherPercentage = (totalOther / requiredHoursByCategory["Other"]) * 100;

  // Calculate the required hours completed (capped by the required hours for each category)
  let requiredHoursCompleted = 0;

  // Add completed hours to the total required hours completed (cap at required hours)
  requiredHoursCompleted += Math.min(
    totalCore,
    requiredHoursByCategory["Core curriculum"]
  );
  requiredHoursCompleted += Math.min(
    totalAnatomy,
    requiredHoursByCategory["Anatomy and Physiology"]
  );
  requiredHoursCompleted += Math.min(
    totalElectives,
    requiredHoursByCategory["Electives"]
  );
  requiredHoursCompleted += Math.min(
    totalPractice,
    requiredHoursByCategory["Practice"]
  );
  requiredHoursCompleted += Math.min(
    totalOther,
    requiredHoursByCategory["Other"]
  );

  // Calculate the adjusted total percentage based on the required hours completed
  const adjustedTotalPercent =
    (requiredHoursCompleted / requiredHoursTotal) * 100;

  const appendum =
    requiredHoursTotal - requiredHoursCompleted > 0
      ? `Hours remaining for requirements: ${
          requiredHoursTotal - requiredHoursCompleted
        }`
      : "Congratulations! You've completed all requirements. Reach out to Kumiko for instructions on getting your AOBTA certificate.";
  // Format the result string (round only for display purposes)
  return `
Core curriculum --------------- ${totalCore} / ${
    requiredHoursByCategory["Core curriculum"]
  } hrs (${Math.floor(corePercentage)}%)
Anatomy and Physiology -------- ${totalAnatomy} / ${
    requiredHoursByCategory["Anatomy and Physiology"]
  } hrs (${Math.floor(anatomyPercentage)}%)
Electives --------------------- ${totalElectives} / ${
    requiredHoursByCategory["Electives"]
  } hrs (${Math.floor(electivesPercentage)}%)
Practice ---------------------- ${totalPractice} / ${
    requiredHoursByCategory["Practice"]
  } hrs (${Math.floor(practicePercentage)}%)
Other ------------------------- ${totalOther} / ${
    requiredHoursByCategory["Other"]
  } hrs (${Math.floor(otherPercentage)}%)
=====================================================
Total hrs --------------------- ${totalActualHours}
Total toward requirements ----- ${requiredHoursCompleted} / ${requiredHoursTotal} hrs (${Math.floor(
    adjustedTotalPercent
  )}%)

${appendum}
    `;
});
