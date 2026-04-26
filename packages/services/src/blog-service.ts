/**
 * BlogService — Blog CMS with markdown content, SEO metadata, newsletter subscriptions
 * Phase 5
 */

import { db, blogPosts, contacts, contactGroups, contactGroupMembers } from "@outreachos/db";
import { eq, and, desc, isNotNull, sql, count } from "drizzle-orm";

export interface CreateBlogPostInput {
  accountId: string;
  title: string;
  slug: string;
  content: string; // markdown
  tags?: string[];
  author?: string;
  metaDescription?: string;
  ogImage?: string;
  publishedAt?: Date;
}

export interface UpdateBlogPostInput {
  title?: string;
  slug?: string;
  content?: string;
  tags?: string[];
  author?: string;
  metaDescription?: string | null;
  ogImage?: string | null;
  publishedAt?: Date | null;
}

const NEWSLETTER_GROUP_NAME = "newsletter_subscriber";

export class BlogService {
  // === Blog Post CRUD ===

  /** Create a blog post */
  static async create(input: CreateBlogPostInput) {
    const [post] = await db
      .insert(blogPosts)
      .values({
        accountId: input.accountId,
        title: input.title,
        slug: input.slug,
        content: input.content,
        tags: input.tags ?? [],
        author: input.author ?? null,
        metaDescription: input.metaDescription ?? null,
        ogImage: input.ogImage ?? null,
        publishedAt: input.publishedAt ?? null,
      })
      .returning();

    return post;
  }

  /** Get a blog post by slug (public) */
  static async getBySlug(slug: string) {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.slug, slug),
          isNotNull(blogPosts.publishedAt),
        ),
      )
      .limit(1);

    return post ?? null;
  }

  /** Get a blog post by ID (admin) */
  static async getById(accountId: string, postId: string) {
    const [post] = await db
      .select()
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.id, postId),
          eq(blogPosts.accountId, accountId),
        ),
      )
      .limit(1);

    return post ?? null;
  }

  /** List published blog posts (public) */
  static async listPublished(limit = 20, offset = 0) {
    return db
      .select()
      .from(blogPosts)
      .where(isNotNull(blogPosts.publishedAt))
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit)
      .offset(offset);
  }

  /** List all blog posts for an account (admin) */
  static async list(accountId: string) {
    return db
      .select()
      .from(blogPosts)
      .where(eq(blogPosts.accountId, accountId))
      .orderBy(desc(blogPosts.createdAt));
  }

  /** Update a blog post */
  static async update(accountId: string, postId: string, data: UpdateBlogPostInput) {
    const [updated] = await db
      .update(blogPosts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(blogPosts.id, postId),
          eq(blogPosts.accountId, accountId),
        ),
      )
      .returning();

    return updated ?? null;
  }

  /** Delete a blog post */
  static async delete(accountId: string, postId: string) {
    await db
      .delete(blogPosts)
      .where(
        and(
          eq(blogPosts.id, postId),
          eq(blogPosts.accountId, accountId),
        ),
      );
  }

  /** Get all published slugs for static generation */
  static async getAllSlugs(): Promise<string[]> {
    try {
      const posts = await db
        .select({ slug: blogPosts.slug })
        .from(blogPosts)
        .where(isNotNull(blogPosts.publishedAt));

      return posts.map((p) => p.slug);
    } catch (error) {
      // Gracefully handle missing table during CI build (migrations not yet run)
      // or other database errors. Empty array = no static paths generated.
      if (error instanceof Error && error.message.includes("relation \"blog_posts\" does not exist")) {
        return [];
      }
      // Re-throw other unexpected errors
      throw error;
    }
  }

  /** List posts by tag */
  static async listByTag(tag: string, limit = 20) {
    return db
      .select()
      .from(blogPosts)
      .where(
        and(
          isNotNull(blogPosts.publishedAt),
          sql`${blogPosts.tags} ? ${tag}`,
        ),
      )
      .orderBy(desc(blogPosts.publishedAt))
      .limit(limit);
  }

  // === Newsletter Subscription ===

  /** Subscribe an email to the newsletter */
  static async subscribeToNewsletter(
    accountId: string,
    email: string,
    firstName?: string,
  ): Promise<{ contactId: string; isNew: boolean }> {
    // Find or create the newsletter group
    let [group] = await db
      .select()
      .from(contactGroups)
      .where(
        and(
          eq(contactGroups.accountId, accountId),
          eq(contactGroups.name, NEWSLETTER_GROUP_NAME),
        ),
      )
      .limit(1);

    if (!group) {
      // Use upsert to handle concurrent inserts gracefully
      const upsertResult = await db
        .insert(contactGroups)
        .values({
          accountId,
          name: NEWSLETTER_GROUP_NAME,
          description: "Newsletter subscribers — auto-managed",
        })
        .onConflictDoNothing({
          target: [contactGroups.accountId, contactGroups.name],
        })
        .returning();

      if (upsertResult.length > 0) {
        // Insert succeeded
        group = upsertResult[0];
      } else {
        // Conflict occurred — fetch the existing group
        const [existingGroup] = await db
          .select()
          .from(contactGroups)
          .where(
            and(
              eq(contactGroups.accountId, accountId),
              eq(contactGroups.name, NEWSLETTER_GROUP_NAME),
            ),
          )
          .limit(1);
        // Guard against race condition: row may have been deleted
        if (!existingGroup) {
          throw new Error(
            `Newsletter group "${NEWSLETTER_GROUP_NAME}" was deleted during upsert for account ${accountId}`
          );
        }
        group = existingGroup;
      }
    }

    // Find or create contact
    let [contact] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.email, email),
          eq(contacts.accountId, accountId),
        ),
      )
      .limit(1);

    let isNew = false;
    if (!contact) {
      // Use upsert to handle concurrent inserts gracefully
      const upsertResult = await db
        .insert(contacts)
        .values({
          accountId,
          firstName: firstName ?? "Subscriber",
          lastName: "",
          email,
        })
        .onConflictDoNothing({
          target: [contacts.email, contacts.accountId],
        })
        .returning();

      if (upsertResult.length > 0) {
        // Insert succeeded
        contact = upsertResult[0];
        isNew = true;
      } else {
        // Conflict occurred — fetch the existing contact
        const [existingContact] = await db
          .select()
          .from(contacts)
          .where(
            and(
              eq(contacts.email, email),
              eq(contacts.accountId, accountId),
            ),
          )
          .limit(1);
        // Guard against race condition: row may have been deleted
        if (!existingContact) {
          throw new Error("Contact was deleted during upsert");
        }
        contact = existingContact;
        isNew = false;
      }
    }

    // Add to newsletter group (ignore duplicate via upsert)
    await db
      .insert(contactGroupMembers)
      .values({
        contactId: contact.id,
        groupId: group.id,
      })
      .onConflictDoNothing({
        target: [contactGroupMembers.contactId, contactGroupMembers.groupId],
      });

    return { contactId: contact.id, isNew };
  }

  /** Get newsletter subscriber count */
  static async getSubscriberCount(accountId: string): Promise<number> {
    const [group] = await db
      .select({ id: contactGroups.id })
      .from(contactGroups)
      .where(
        and(
          eq(contactGroups.accountId, accountId),
          eq(contactGroups.name, NEWSLETTER_GROUP_NAME),
        ),
      )
      .limit(1);

    if (!group) return 0;

    const [result] = await db
      .select({ count: count() })
      .from(contactGroupMembers)
      .where(eq(contactGroupMembers.groupId, group.id));

    return result?.count ?? 0;
  }
}
