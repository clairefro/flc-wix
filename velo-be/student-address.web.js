import { currentMember } from "wix-members-backend";
import { Permissions, webMethod } from "wix-web-module";
import { getContactById } from "wix-crm-backend";
import { toBase64 } from "backend/base64-utils.web";

export const getUserAddressB64 = webMethod(Permissions.SiteMember, async () => {
  try {
    // Get the current member's ID
    const member = await currentMember.getMember();
    if (!member) {
      throw new Error("User not logged in.");
    }

    const memberId = member._id;

    // Fetch the contact information by member ID
    const contact = await getContactById(memberId);

    // Retrieve the Address custom field from the contact
    // const address = contact.customFields?.Address || null;
    //             console.log({address})
    const firstAddress = contact.addresses.length
      ? Object.values(contact.addresses[0]).join(", ")
      : null;
    // encode base64 as a small protection of passing sensitive data to frontend
    const encoded = await toBase64(firstAddress);
    return encoded;
  } catch (error) {
    console.error("Error fetching user address:", error);
    throw error;
  }
});
