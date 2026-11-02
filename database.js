/* =========================================
   MEKA — DATABASE ENGINE
   Real Supabase Database Integration
========================================= */

"use strict";

import { supabase } from "./supabase.js";
import { getCurrentUser } from "./auth.js";


/* =========================================
   GENERAL HELPERS
========================================= */

const PAGE_SIZE = 30;

function currentUserId() {
  const user = getCurrentUser();

  if (!user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  return user.id;
}


function cleanText(value, maxLength = 10000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}


function requireValue(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}


async function execute(query) {
  const { data, error } = await query;

  if (error) {
    console.error("MEKA Database Error:", error);
    throw error;
  }

  return data;
}


/* =========================================
   PROFILES
========================================= */

export const ProfilesDB = {

  async getMyProfile() {
    const id = currentUserId();

    return await execute(
      supabase
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single()
    );
  },


  async getProfile(userId) {
    requireValue(userId, "معرف المستخدم مطلوب.");

    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        username,
        user_code,
        display_name,
        avatar_path,
        cover_path,
        bio,
        account_type,
        is_verified,
        is_discoverable,
        created_at
      `)
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;

    return data;
  },


  async searchUsers(searchTerm, limit = 20) {
    const term = cleanText(searchTerm, 60);

    if (term.length < 2) {
      return [];
    }

    let query = supabase
      .from("profiles")
      .select(`
        id,
        username,
        user_code,
        display_name,
        avatar_path,
        bio,
        is_verified
      `)
      .eq("is_discoverable", true)
      .limit(Math.min(limit, 50));

    if (/^MK-[A-Z0-9]+$/i.test(term)) {
      query = query.eq("user_code", term.toUpperCase());
    } else if (term.startsWith("@")) {
      query = query.ilike(
        "username",
        term.slice(1)
      );
    } else {
      query = query.ilike(
        "display_name",
        `%${term}%`
      );
    }

    return await execute(query);
  },


  async updateMyProfile(values) {
    const id = currentUserId();

    const allowed = [
      "username",
      "display_name",
      "avatar_path",
      "cover_path",
      "bio",
      "account_type",
      "is_discoverable",
      "online_visibility",
      "last_seen_visibility"
    ];

    const update = {};

    for (const key of allowed) {
      if (Object.hasOwn(values, key)) {
        update[key] = values[key];
      }
    }

    if (update.display_name !== undefined) {
      update.display_name =
        cleanText(update.display_name, 60);

      requireValue(
        update.display_name,
        "اكتب اسمًا صحيحًا."
      );
    }

    if (update.bio !== undefined) {
      update.bio = cleanText(update.bio, 300);
    }

    update.updated_at = new Date().toISOString();

    return await execute(
      supabase
        .from("profiles")
        .update(update)
        .eq("id", id)
        .select()
        .single()
    );
  }

};


/* =========================================
   USER SETTINGS
========================================= */

export const SettingsDB = {

  async get() {
    const id = currentUserId();

    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", id)
      .maybeSingle();

    if (error) throw error;

    return data;
  },


  async save(values) {
    const id = currentUserId();

    const allowed = [
      "language",
      "theme",
      "settings",
      "privacy",
      "notification_preferences"
    ];

    const update = {
      user_id: id,
      updated_at: new Date().toISOString()
    };

    for (const key of allowed) {
      if (Object.hasOwn(values, key)) {
        update[key] = values[key];
      }
    }

    return await execute(
      supabase
        .from("user_settings")
        .upsert(update, {
          onConflict: "user_id"
        })
        .select()
        .single()
    );
  }

};


/* =========================================
   FRIENDSHIPS
========================================= */

export const FriendsDB = {

  async getMyFriends() {
    const id = currentUserId();

    return await execute(
      supabase
        .from("friendships")
        .select(`
          id,
          requester_id,
          addressee_id,
          status,
          created_at
        `)
        .or(
          `requester_id.eq.${id},addressee_id.eq.${id}`
        )
        .eq("status", "accepted")
        .order("created_at", {
          ascending: false
        })
    );
  },


  async getRequests() {
    const id = currentUserId();

    return await execute(
      supabase
        .from("friendships")
        .select("*")
        .eq("addressee_id", id)
        .eq("status", "pending")
        .order("created_at", {
          ascending: false
        })
    );
  },


  async sendRequest(targetUserId) {
    const id = currentUserId();

    requireValue(
      targetUserId,
      "المستخدم المطلوب غير محدد."
    );

    if (id === targetUserId) {
      throw new Error("لا يمكنك إضافة نفسك.");
    }

    return await execute(
      supabase
        .from("friendships")
        .insert({
          requester_id: id,
          addressee_id: targetUserId,
          status: "pending"
        })
        .select()
        .single()
    );
  },


  async respond(requestId, accepted) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("friendships")
        .update({
          status: accepted
            ? "accepted"
            : "rejected",
          updated_at: new Date().toISOString()
        })
        .eq("id", requestId)
        .eq("addressee_id", id)
        .eq("status", "pending")
        .select()
        .single()
    );
  },


  async remove(friendshipId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("friendships")
        .delete()
        .eq("id", friendshipId)
        .or(
          `requester_id.eq.${id},addressee_id.eq.${id}`
        )
    );
  },


  async block(targetUserId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("user_blocks")
        .insert({
          blocker_id: id,
          blocked_id: targetUserId
        })
    );
  },


  async unblock(targetUserId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("user_blocks")
        .delete()
        .eq("blocker_id", id)
        .eq("blocked_id", targetUserId)
    );
  },


  async follow(targetUserId) {
    const id = currentUserId();

    if (id === targetUserId) {
      throw new Error("لا يمكنك متابعة نفسك.");
    }

    return await execute(
      supabase
        .from("follows")
        .insert({
          follower_id: id,
          followed_id: targetUserId
        })
    );
  },


  async unfollow(targetUserId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("follows")
        .delete()
        .eq("follower_id", id)
        .eq("followed_id", targetUserId)
    );
  }

};


/* =========================================
   CONVERSATIONS
========================================= */

export const ConversationsDB = {

  async getMyConversations() {
    const id = currentUserId();

    return await execute(
      supabase
        .from("conversation_members")
        .select(`
          conversation_id,
          member_role,
          muted_until,
          archived_at,
          conversations (
            id,
            conversation_type,
            title,
            created_by,
            last_message_at,
            created_at
          )
        `)
        .eq("user_id", id)
        .is("archived_at", null)
        .order("joined_at", {
          ascending: false
        })
    );
  },


  async getMembers(conversationId) {
    requireValue(
      conversationId,
      "المحادثة غير محددة."
    );

    return await execute(
      supabase
        .from("conversation_members")
        .select(`
          user_id,
          member_role,
          joined_at,
          profiles (
            id,
            username,
            user_code,
            display_name,
            avatar_path,
            is_verified
          )
        `)
        .eq("conversation_id", conversationId)
    );
  },


  async createDirectConversation(targetUserId) {
    const id = currentUserId();

    requireValue(
      targetUserId,
      "اختر المستخدم أولًا."
    );

    if (id === targetUserId) {
      throw new Error("لا يمكنك بدء محادثة مع نفسك.");
    }

    /*
      نبحث عن محادثة مباشرة موجودة بالفعل
      بين المستخدمين قبل إنشاء محادثة جديدة.
    */

    const myMemberships = await execute(
      supabase
        .from("conversation_members")
        .select(`
          conversation_id,
          conversations!inner (
            id,
            conversation_type
          )
        `)
        .eq("user_id", id)
    );

    const directIds = myMemberships
      .filter(item =>
        item.conversations?.conversation_type === "direct"
      )
      .map(item => item.conversation_id);

    if (directIds.length) {
      const shared = await execute(
        supabase
          .from("conversation_members")
          .select("conversation_id")
          .eq("user_id", targetUserId)
          .in("conversation_id", directIds)
      );

      if (shared.length) {
        return {
          id: shared[0].conversation_id,
          existing: true
        };
      }
    }

    /*
      الإنشاء يتم على مرحلتين.
      الأفضل لاحقًا نقل العمليتين إلى RPC
      لضمان تنفيذ ذري عند التزامن.
    */

    const conversation = await execute(
      supabase
        .from("conversations")
        .insert({
          conversation_type: "direct",
          created_by: id
        })
        .select()
        .single()
    );

    await execute(
      supabase
        .from("conversation_members")
        .insert([
          {
            conversation_id: conversation.id,
            user_id: id,
            member_role: "member"
          },
          {
            conversation_id: conversation.id,
            user_id: targetUserId,
            member_role: "member"
          }
        ])
    );

    return {
      ...conversation,
      existing: false
    };
  },


  async createGroup({
    title,
    memberIds = []
  }) {
    const id = currentUserId();

    const name = cleanText(title, 100);

    requireValue(
      name,
      "اكتب اسم المجموعة."
    );

    const uniqueMembers = [
      ...new Set([id, ...memberIds])
    ];

    const conversation = await execute(
      supabase
        .from("conversations")
        .insert({
          conversation_type: "group",
          title: name,
          created_by: id
        })
        .select()
        .single()
    );

    await execute(
      supabase
        .from("conversation_members")
        .insert(
          uniqueMembers.map(userId => ({
            conversation_id: conversation.id,
            user_id: userId,
            member_role:
              userId === id ? "admin" : "member"
          }))
        )
    );

    return conversation;
  },


  async archive(conversationId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("conversation_members")
        .update({
          archived_at: new Date().toISOString()
        })
        .eq("conversation_id", conversationId)
        .eq("user_id", id)
    );
  },


  async mute(conversationId, until) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("conversation_members")
        .update({
          muted_until: until
        })
        .eq("conversation_id", conversationId)
        .eq("user_id", id)
    );
  }

};


/* =========================================
   MESSAGES
========================================= */

export const MessagesDB = {

  async getMessages(
    conversationId,
    {
      limit = PAGE_SIZE,
      before = null
    } = {}
  ) {
    requireValue(
      conversationId,
      "المحادثة غير محددة."
    );

    let query = supabase
      .from("messages")
      .select(`
        id,
        conversation_id,
        sender_id,
        message_type,
        body,
        reply_to_id,
        is_edited,
        is_deleted,
        expires_at,
        created_at,
        edited_at,
        profiles (
          id,
          display_name,
          username,
          avatar_path
        )
      `)
      .eq("conversation_id", conversationId)
      .order("created_at", {
        ascending: false
      })
      .limit(Math.min(limit, 100));

    if (before) {
      query = query.lt("created_at", before);
    }

    const rows = await execute(query);

    return rows.reverse();
  },


  async sendMessage({
    conversationId,
    body,
    messageType = "text",
    replyToId = null
  }) {
    const id = currentUserId();

    const content = cleanText(body, 10000);

    requireValue(
      conversationId,
      "المحادثة غير محددة."
    );

    requireValue(
      content,
      "لا يمكن إرسال رسالة فارغة."
    );

    const allowedTypes = [
      "text",
      "image",
      "video",
      "audio",
      "file",
      "location",
      "system"
    ];

    if (!allowedTypes.includes(messageType)) {
      throw new Error("نوع الرسالة غير مدعوم.");
    }

    const message = await execute(
      supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: id,
          message_type: messageType,
          body: content,
          reply_to_id: replyToId
        })
        .select()
        .single()
    );

    /*
      تحديث وقت آخر رسالة.
      سياسة RLS في قاعدة البيانات هي التي
      تحدد هل يحق للمستخدم تنفيذ التحديث.
    */

    await supabase
      .from("conversations")
      .update({
        last_message_at: message.created_at
      })
      .eq("id", conversationId);

    return message;
  },


  async editMessage(messageId, body) {
    const id = currentUserId();

    const content = cleanText(body, 10000);

    requireValue(
      content,
      "الرسالة لا يمكن أن تكون فارغة."
    );

    return await execute(
      supabase
        .from("messages")
        .update({
          body: content,
          is_edited: true,
          edited_at: new Date().toISOString()
        })
        .eq("id", messageId)
        .eq("sender_id", id)
        .select()
        .single()
    );
  },


  async deleteMessage(messageId) {
    const id = currentUserId();

    /*
      حذف منطقي بدل حذف سجل الرسالة نهائيًا.
    */

    return await execute(
      supabase
        .from("messages")
        .update({
          body: null,
          is_deleted: true
        })
        .eq("id", messageId)
        .eq("sender_id", id)
        .select()
        .single()
    );
  },


  async react(messageId, reaction) {
    const id = currentUserId();

    requireValue(
      messageId,
      "الرسالة غير محددة."
    );

    requireValue(
      reaction,
      "اختر تفاعلًا."
    );

    return await execute(
      supabase
        .from("message_reactions")
        .upsert({
          message_id: messageId,
          user_id: id,
          reaction
        }, {
          onConflict: "message_id,user_id"
        })
        .select()
        .single()
    );
  },


  async markRead(messageId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("message_receipts")
        .upsert({
          message_id: messageId,
          user_id: id,
          delivered_at: new Date().toISOString(),
          read_at: new Date().toISOString()
        }, {
          onConflict: "message_id,user_id"
        })
    );
  },


  subscribe(conversationId, callback) {
    requireValue(
      conversationId,
      "المحادثة غير محددة."
    );

    const channel = supabase
      .channel(`meka-messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        callback
      )
      .subscribe();

    return channel;
  }

};


/* =========================================
   GROUPS
========================================= */

export const GroupsDB = {

  async create({
    name,
    description = "",
    isPrivate = true
  }) {
    const id = currentUserId();

    const group = await execute(
      supabase
        .from("groups")
        .insert({
          name: cleanText(name, 100),
          description: cleanText(description, 1000),
          created_by: id,
          is_private: Boolean(isPrivate)
        })
        .select()
        .single()
    );

    await execute(
      supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: id,
          member_role: "admin"
        })
    );

    return group;
  },


  async getMyGroups() {
    const id = currentUserId();

    return await execute(
      supabase
        .from("group_members")
        .select(`
          group_id,
          member_role,
          joined_at,
          groups (
            id,
            name,
            description,
            created_by,
            is_private,
            created_at
          )
        `)
        .eq("user_id", id)
    );
  },


  async addMember(groupId, userId) {
    return await execute(
      supabase
        .from("group_members")
        .insert({
          group_id: groupId,
          user_id: userId,
          member_role: "member"
        })
        .select()
        .single()
    );
  },


  async removeMember(groupId, userId) {
    return await execute(
      supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", userId)
    );
  }

};


/* =========================================
   POSTS
========================================= */

export const PostsDB = {

  async getFeed(limit = PAGE_SIZE) {
    return await execute(
      supabase
        .from("posts")
        .select(`
          id,
          author_id,
          body,
          visibility,
          comments_enabled,
          created_at,
          profiles (
            id,
            username,
            display_name,
            avatar_path,
            is_verified
          )
        `)
        .eq("visibility", "public")
        .order("created_at", {
          ascending: false
        })
        .limit(Math.min(limit, 100))
    );
  },


  async create(body, visibility = "public") {
    const id = currentUserId();

    const content = cleanText(body, 10000);

    requireValue(
      content,
      "اكتب محتوى المنشور."
    );

    const allowed = [
      "public",
      "followers",
      "private"
    ];

    if (!allowed.includes(visibility)) {
      throw new Error("إعداد الخصوصية غير صحيح.");
    }

    return await execute(
      supabase
        .from("posts")
        .insert({
          author_id: id,
          body: content,
          visibility
        })
        .select()
        .single()
    );
  },


  async delete(postId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", id)
    );
  },


  async react(postId, reaction = "like") {
    const id = currentUserId();

    return await execute(
      supabase
        .from("content_reactions")
        .upsert({
          user_id: id,
          content_type: "post",
          content_id: postId,
          reaction
        }, {
          onConflict:
            "user_id,content_type,content_id"
        })
        .select()
        .single()
    );
  },


  async comment(postId, body) {
    const id = currentUserId();

    const content = cleanText(body, 3000);

    requireValue(
      content,
      "اكتب تعليقًا أولًا."
    );

    return await execute(
      supabase
        .from("comments")
        .insert({
          post_id: postId,
          author_id: id,
          body: content
        })
        .select()
        .single()
    );
  },


  async getComments(postId) {
    return await execute(
      supabase
        .from("comments")
        .select(`
          id,
          post_id,
          author_id,
          parent_comment_id,
          body,
          created_at,
          profiles (
            id,
            display_name,
            username,
            avatar_path
          )
        `)
        .eq("post_id", postId)
        .order("created_at", {
          ascending: true
        })
    );
  }

};


/* =========================================
   STORIES
========================================= */

export const StoriesDB = {

  async getActiveStories(limit = 100) {
    const now = new Date().toISOString();

    return await execute(
      supabase
        .from("stories")
        .select(`
          id,
          author_id,
          storage_path,
          body,
          background,
          visibility,
          expires_at,
          created_at,
          profiles (
            id,
            username,
            display_name,
            avatar_path
          )
        `)
        .gt("expires_at", now)
        .order("created_at", {
          ascending: false
        })
        .limit(Math.min(limit, 200))
    );
  },


  async create({
    storagePath = null,
    body = null,
    background = {},
    visibility = "contacts"
  }) {
    const id = currentUserId();

    if (!storagePath && !cleanText(body, 1000)) {
      throw new Error("أضف صورة أو نصًا للحالة.");
    }

    return await execute(
      supabase
        .from("stories")
        .insert({
          author_id: id,
          storage_path: storagePath,
          body: cleanText(body, 1000) || null,
          background,
          visibility
        })
        .select()
        .single()
    );
  },


  async markViewed(storyId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("story_views")
        .upsert({
          story_id: storyId,
          viewer_id: id
        }, {
          onConflict: "story_id,viewer_id"
        })
    );
  },


  async delete(storyId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("stories")
        .delete()
        .eq("id", storyId)
        .eq("author_id", id)
    );
  }

};


/* =========================================
   NOTIFICATIONS
========================================= */

export const NotificationsDB = {

  async getAll(limit = 30) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("notifications")
        .select(`
          id,
          actor_id,
          notification_type,
          payload,
          read_at,
          created_at,
          profiles (
            id,
            display_name,
            avatar_path
          )
        `)
        .eq("user_id", id)
        .order("created_at", {
          ascending: false
        })
        .limit(Math.min(limit, 100))
    );
  },


  async markRead(notificationId) {
    const id = currentUserId();

    return await execute(
      supabase
        .from("notifications")
        .update({
          read_at: new Date().toISOString()
        })
        .eq("id", notificationId)
        .eq("user_id", id)
    );
  },


  async markAllRead() {
    const id = currentUserId();

    return await execute(
      supabase
        .from("notifications")
        .update({
          read_at: new Date().toISOString()
        })
        .eq("user_id", id)
        .is("read_at", null)
    );
  },


  subscribe(callback) {
    const id = currentUserId();

    return supabase
      .channel(`meka-notifications-${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${id}`
        },
        callback
      )
      .subscribe();
  }

};


/* =========================================
   DATABASE HEALTH
========================================= */

export async function checkDatabase() {
  try {

    const { data, error } = await supabase
      .from("platform_settings")
      .select("brand_name,brand_slug,default_locale")
      .eq("id", 1)
      .single();

    if (error) throw error;

    return {
      connected: true,
      platform: data
    };

  } catch (error) {

    console.error(
      "MEKA database health:",
      error
    );

    return {
      connected: false,
      error: error.message
    };

  }
}


/* =========================================
   END MEKA DATABASE
========================================= */
