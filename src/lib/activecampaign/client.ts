/**
 * ActiveCampaign API Client
 *
 * Handles communication with ActiveCampaign for marketing automation.
 * Used to add free tier users to marketing campaigns for lead nurturing.
 */

interface ContactMetadata {
  firstName?: string;
  lastName?: string;
  reportCount?: number;
  lastReportDate?: string;
  propertyState?: string;
}

interface ActiveCampaignContact {
  contact: {
    id: string;
    email: string;
  };
}

/**
 * Add a contact to ActiveCampaign
 *
 * @param email - User's email address
 * @param metadata - Additional contact data (report count, last report date, property state)
 * @returns ActiveCampaign contact object
 */
export async function addContact(
  email: string,
  metadata?: ContactMetadata
): Promise<ActiveCampaignContact> {
  if (!process.env.ACTIVECAMPAIGN_API_KEY) {
    throw new Error("ACTIVECAMPAIGN_API_KEY is not configured");
  }

  if (!process.env.ACTIVECAMPAIGN_API_URL) {
    throw new Error("ACTIVECAMPAIGN_API_URL is not configured");
  }

  const response = await fetch(
    `${process.env.ACTIVECAMPAIGN_API_URL}/api/3/contacts`,
    {
      method: "POST",
      headers: {
        "Api-Token": process.env.ACTIVECAMPAIGN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contact: {
          email,
          firstName: metadata?.firstName || "",
          lastName: metadata?.lastName || "",
          fieldValues: [
            {
              field: "1", // Custom field ID for report count
              value: metadata?.reportCount?.toString() || "1",
            },
            {
              field: "2", // Custom field ID for last report date
              value: metadata?.lastReportDate || new Date().toISOString(),
            },
            {
              field: "3", // Custom field ID for property state
              value: metadata?.propertyState || "",
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ActiveCampaign API error: ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Create or get a tag by name
 *
 * @param tagName - Tag name to create/get
 * @returns Tag ID
 */
async function getOrCreateTag(tagName: string): Promise<string> {
  if (!process.env.ACTIVECAMPAIGN_API_KEY || !process.env.ACTIVECAMPAIGN_API_URL) {
    throw new Error("ActiveCampaign API not configured");
  }

  // Create the tag (ActiveCampaign returns existing tag if name already exists)
  const response = await fetch(
    `${process.env.ACTIVECAMPAIGN_API_URL}/api/3/tags`,
    {
      method: "POST",
      headers: {
        "Api-Token": process.env.ACTIVECAMPAIGN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag: {
          tag: tagName,
          tagType: "contact",
          description: `Glass Loans - ${tagName}`,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create tag "${tagName}": ${errorText}`);
  }

  const data = await response.json();
  return data.tag.id;
}

/**
 * Add tags to an ActiveCampaign contact
 *
 * @param contactId - ActiveCampaign contact ID
 * @param tags - Array of tag names to add
 */
export async function addTags(contactId: string, tags: string[]): Promise<void> {
  if (!process.env.ACTIVECAMPAIGN_API_KEY) {
    throw new Error("ACTIVECAMPAIGN_API_KEY is not configured");
  }

  if (!process.env.ACTIVECAMPAIGN_API_URL) {
    throw new Error("ACTIVECAMPAIGN_API_URL is not configured");
  }

  // Create/get tags and add them to contact
  for (const tagName of tags) {
    try {
      // Get or create the tag
      const tagId = await getOrCreateTag(tagName);

      // Add tag to contact
      const response = await fetch(
        `${process.env.ACTIVECAMPAIGN_API_URL}/api/3/contactTags`,
        {
          method: "POST",
          headers: {
            "Api-Token": process.env.ACTIVECAMPAIGN_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contactTag: {
              contact: contactId,
              tag: tagId,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to add tag "${tagName}" to contact: ${errorText}`);
      }
    } catch (error: any) {
      console.error(`Error adding tag "${tagName}":`, error.message);
    }
  }
}

/**
 * Subscribe a contact to a list in ActiveCampaign
 *
 * @param contactId - ActiveCampaign contact ID
 * @param listId - ActiveCampaign list ID (default: 11)
 */
export async function addContactToList(
  contactId: string,
  listId: string = "11"
): Promise<void> {
  if (!process.env.ACTIVECAMPAIGN_API_KEY) {
    throw new Error("ACTIVECAMPAIGN_API_KEY is not configured");
  }

  if (!process.env.ACTIVECAMPAIGN_API_URL) {
    throw new Error("ACTIVECAMPAIGN_API_URL is not configured");
  }

  const response = await fetch(
    `${process.env.ACTIVECAMPAIGN_API_URL}/api/3/contactLists`,
    {
      method: "POST",
      headers: {
        "Api-Token": process.env.ACTIVECAMPAIGN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contactList: {
          list: listId,
          contact: contactId,
          status: 1, // 1 = subscribed, 2 = unsubscribed
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ActiveCampaign list subscription error: ${response.statusText} - ${errorText}`);
  }
}

/**
 * Add a free user to ActiveCampaign after report submission
 *
 * This is a convenience function that handles both adding the contact,
 * subscribing them to the list, and tagging them appropriately.
 *
 * @param email - User's email
 * @param reportCount - Total number of reports user has submitted
 * @param propertyState - State of the property (e.g., "TX", "CA")
 * @param firstName - User's first name (optional)
 * @param lastName - User's last name (optional)
 */
export async function addFreeUser(
  email: string,
  reportCount: number,
  propertyState?: string,
  firstName?: string,
  lastName?: string
): Promise<void> {
  try {
    console.log(`📧 [ActiveCampaign] Adding free user: ${email}`);

    // Add contact to ActiveCampaign
    const contact = await addContact(email, {
      firstName: firstName || "",
      lastName: lastName || "",
      reportCount,
      lastReportDate: new Date().toISOString(),
      propertyState: propertyState || "",
    });

    console.log(`✅ [ActiveCampaign] Contact created: ${contact.contact.id}`);

    // Add contact to list 11
    await addContactToList(contact.contact.id, "11");
    console.log(`✅ [ActiveCampaign] Contact added to list 11`);

    // Prepare tags
    const tags = [
      "free-underwrite-user",
      "glass-loans",
    ];

    // Add property state tag if available
    if (propertyState) {
      tags.push(`property-state-${propertyState.toLowerCase()}`);
    }

    // Add tags to contact
    await addTags(contact.contact.id, tags);

    console.log(`✅ [ActiveCampaign] Tags added: ${tags.join(", ")}`);
    console.log(`✅ [ActiveCampaign] Free user ${email} successfully added to marketing automation`);
  } catch (error: any) {
    // Log error but don't throw - we don't want ActiveCampaign failures to break report submissions
    console.error(`❌ [ActiveCampaign] Failed to add user ${email}:`, error.message);
    throw error; // Re-throw so caller can handle
  }
}
