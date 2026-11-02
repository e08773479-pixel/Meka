import {
  PostsDB,
  StoriesDB
} from "./database.js";

import {
  MekaStorage
} from "./supabase.js";

import {
  MEKA_CONFIG
} from "./config.js";

/* =====================================
   MEKA SOCIAL ENGINE
===================================== */

const SocialState = {
  posts: [],
  stories: [],
  loading: false,
  currentFeed: "all",
  currentUserId: null
};

const SocialEvents = new EventTarget();

function emit(name, detail = {}) {
  SocialEvents.dispatchEvent(
    new CustomEvent(name, { detail })
  );
}

function el(selector, root = document) {
  return root.querySelector(selector);
}

function text(value) {
  return String(value ?? "");
}

function notify(message, type = "info") {
  emit("toast", { message, type });

  const toast = el("#meka-toast");

  if (toast) {
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add("show");

    clearTimeout(notify.timer);

    notify.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function safeImageUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value, location.origin);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return "";
    }

    return url.href;
  } catch {
    return "";
  }
}

/* =====================================
   FEED
===================================== */

export async function loadFeed(options = {}) {
  try {
    SocialState.loading = true;

    emit("feed-loading", { loading: true });

    const result = await PostsDB.getFeed(options);

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تحميل المنشورات"
      );
    }

    SocialState.posts = result.data || [];

    renderFeed(SocialState.posts);

    emit("feed-loaded", {
      posts: SocialState.posts
    });

    return SocialState.posts;

  } catch (error) {
    console.error("MEKA feed:", error);

    notify("تعذر تحميل المنشورات", "error");

    return [];

  } finally {
    SocialState.loading = false;

    emit("feed-loading", { loading: false });
  }
}

function getFeedContainer() {
  return (
    el("#social-feed") ||
    el("#posts-list") ||
    el("[data-social-feed]")
  );
}

function renderFeed(posts) {
  const container = getFeedContainer();

  if (!container) {
    emit("render-feed", { posts });
    return;
  }

  container.replaceChildren();

  if (!posts.length) {
    const empty = document.createElement("div");

    empty.className = "meka-empty-state";
    empty.textContent = "لا توجد منشورات حتى الآن";

    container.appendChild(empty);
    return;
  }

  posts.forEach(post => {
    container.appendChild(createPostElement(post));
  });
}

function createPostElement(post) {
  const article = document.createElement("article");

  article.className = "meka-post";
  article.dataset.postId = post.id;

  const header = document.createElement("header");
  header.className = "meka-post-header";

  const avatar = document.createElement("div");
  avatar.className = "meka-post-avatar";

  const authorName =
    post.profile?.display_name ||
    post.author?.display_name ||
    post.display_name ||
    "مستخدم MEKA";

  avatar.textContent =
    authorName.trim().charAt(0) || "M";

  const author = document.createElement("div");
  author.className = "meka-post-author";

  const name = document.createElement("strong");
  name.textContent = authorName;

  const date = document.createElement("time");
  date.textContent = formatDate(post.created_at);

  author.append(name, date);
  header.append(avatar, author);

  const content = document.createElement("div");
  content.className = "meka-post-content";

  const body = document.createElement("p");
  body.textContent = post.content || "";

  content.appendChild(body);

  const mediaUrl = safeImageUrl(
    post.media_url ||
    post.image_url
  );

  if (mediaUrl) {
    const image = document.createElement("img");

    image.src = mediaUrl;
    image.alt = "مرفق المنشور";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    content.appendChild(image);
  }

  const actions = document.createElement("div");
  actions.className = "meka-post-actions";

  const likeButton = document.createElement("button");
  likeButton.type = "button";
  likeButton.textContent = "إعجاب";
  likeButton.dataset.action = "like";

  const commentButton = document.createElement("button");
  commentButton.type = "button";
  commentButton.textContent = "تعليق";
  commentButton.dataset.action = "comment";

  const shareButton = document.createElement("button");
  shareButton.type = "button";
  shareButton.textContent = "مشاركة";
  shareButton.dataset.action = "share";

  actions.append(
    likeButton,
    commentButton,
    shareButton
  );

  const comments = document.createElement("div");
  comments.className = "meka-post-comments";
  comments.hidden = true;

  article.append(
    header,
    content,
    actions,
    comments
  );

  likeButton.addEventListener("click", async () => {
    await reactToPost(post.id, "like");
  });

  commentButton.addEventListener("click", async () => {
    comments.hidden = !comments.hidden;

    if (!comments.hidden) {
      await loadComments(post.id, comments);
    }
  });

  shareButton.addEventListener("click", async () => {
    await sharePost(post);
  });

  return article;
}

/* =====================================
   CREATE POST
===================================== */

export async function createPost(content, options = {}) {
  const body = text(content).trim();

  if (!body && !options.media_url) {
    notify("اكتب شيئًا قبل النشر", "warning");
    return null;
  }

  try {
    const result = await PostsDB.create({
      content: body,
      ...options
    });

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر نشر المنشور"
      );
    }

    await loadFeed();

    emit("post-created", {
      post: result.data
    });

    notify("تم نشر المنشور", "success");

    return result.data;

  } catch (error) {
    console.error("MEKA create post:", error);

    notify(
      error.message || "فشل نشر المنشور",
      "error"
    );

    return null;
  }
}

/* =====================================
   DELETE POST
===================================== */

export async function deletePost(postId) {
  if (!postId) return false;

  try {
    const result = await PostsDB.delete(postId);

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر حذف المنشور"
      );
    }

    SocialState.posts =
      SocialState.posts.filter(
        post => post.id !== postId
      );

    const node = el(
      `[data-post-id="${CSS.escape(postId)}"]`
    );

    node?.remove();

    emit("post-deleted", { postId });

    notify("تم حذف المنشور", "success");

    return true;

  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

/* =====================================
   POST REACTIONS
===================================== */

export async function reactToPost(postId, reaction = "like") {
  if (!postId) return false;

  try {
    const result = await PostsDB.react(
      postId,
      reaction
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تسجيل التفاعل"
      );
    }

    emit("post-reacted", {
      postId,
      reaction
    });

    return true;

  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

/* =====================================
   COMMENTS
===================================== */

export async function loadComments(postId, container) {
  if (!postId) return [];

  try {
    const result = await PostsDB.getComments(postId);

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تحميل التعليقات"
      );
    }

    const comments = result.data || [];

    if (container) {
      container.replaceChildren();

      comments.forEach(comment => {
        const item = document.createElement("p");

        item.className = "meka-comment";

        const author = document.createElement("strong");

        author.textContent =
          comment.profile?.display_name ||
          comment.author?.display_name ||
          "مستخدم";

        const body = document.createElement("span");

        body.textContent =
          comment.content ||
          comment.body ||
          "";

        item.append(author, body);

        container.appendChild(item);
      });

      const form = createCommentForm(postId, container);

      container.appendChild(form);
    }

    emit("comments-loaded", {
      postId,
      comments
    });

    return comments;

  } catch (error) {
    console.error("MEKA comments:", error);

    notify("تعذر تحميل التعليقات", "error");

    return [];
  }
}

function createCommentForm(postId, container) {
  const form = document.createElement("form");

  form.className = "meka-comment-form";

  const input = document.createElement("input");

  input.type = "text";
  input.placeholder = "اكتب تعليقك...";
  input.maxLength = 2000;
  input.required = true;

  const button = document.createElement("button");

  button.type = "submit";
  button.textContent = "إرسال";

  form.append(input, button);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const body = input.value.trim();

    if (!body) return;

    const result = await addComment(postId, body);

    if (result) {
      input.value = "";
      await loadComments(postId, container);
    }
  });

  return form;
}

export async function addComment(postId, content) {
  const body = text(content).trim();

  if (!postId || !body) return null;

  try {
    const result = await PostsDB.comment(
      postId,
      body
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر إضافة التعليق"
      );
    }

    emit("comment-created", {
      postId,
      comment: result.data
    });

    return result.data;

  } catch (error) {
    notify(error.message, "error");
    return null;
  }
}

/* =====================================
   SHARE POST
===================================== */

export async function sharePost(post) {
  if (!post?.id) return false;

  const shareUrl =
    `${location.origin}${location.pathname}` +
    `?post=${encodeURIComponent(post.id)}`;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "MEKA",
        text: post.content || "شاهد هذا المنشور",
        url: shareUrl
      });
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);

      notify("تم نسخ رابط المنشور", "success");
    } else {
      notify("المشاركة غير مدعومة في هذا المتصفح", "warning");
      return false;
    }

    emit("post-shared", { postId: post.id });

    return true;

  } catch (error) {
    if (error.name !== "AbortError") {
      notify("تعذرت مشاركة المنشور", "error");
    }

    return false;
  }
}

/* =====================================
   STORIES
===================================== */

export async function loadStories() {
  try {
    const result = await StoriesDB.getActiveStories();

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر تحميل الحالات"
      );
    }

    SocialState.stories = result.data || [];

    renderStories(SocialState.stories);

    emit("stories-loaded", {
      stories: SocialState.stories
    });

    return SocialState.stories;

  } catch (error) {
    console.error("MEKA stories:", error);

    notify("تعذر تحميل الحالات", "error");

    return [];
  }
}

function getStoriesContainer() {
  return (
    el("#stories-list") ||
    el("#stories-container") ||
    el("[data-stories-list]")
  );
}

function renderStories(stories) {
  const container = getStoriesContainer();

  if (!container) {
    emit("render-stories", { stories });
    return;
  }

  container.replaceChildren();

  if (!stories.length) {
    const empty = document.createElement("span");

    empty.textContent = "لا توجد حالات حاليًا";

    container.appendChild(empty);
    return;
  }

  stories.forEach(story => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "meka-story-item";

    const avatar = document.createElement("div");

    avatar.className = "meka-story-avatar";

    const name = document.createElement("span");

    name.textContent =
      story.profile?.display_name ||
      story.author?.display_name ||
      "مستخدم";

    avatar.textContent =
      name.textContent.charAt(0) || "M";

    button.append(avatar, name);

    button.addEventListener("click", async () => {
      await viewStory(story);
    });

    container.appendChild(button);
  });
}

/* =====================================
   CREATE STORY
===================================== */

export async function createStory(content, options = {}) {
  const body = text(content).trim();

  if (!body && !options.media_url) {
    notify("أضف نصًا أو صورة للحالة", "warning");
    return null;
  }

  try {
    const result = await StoriesDB.create({
      content: body,
      ...options
    });

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر إنشاء الحالة"
      );
    }

    await loadStories();

    emit("story-created", {
      story: result.data
    });

    notify("تم نشر الحالة", "success");

    return result.data;

  } catch (error) {
    notify(error.message, "error");
    return null;
  }
}

/* =====================================
   VIEW STORY
===================================== */

export async function viewStory(story) {
  if (!story?.id) return;

  try {
    await StoriesDB.markViewed(story.id);

    emit("story-opened", { story });

  } catch (error) {
    console.error("MEKA story view:", error);
  }
}

/* =====================================
   DELETE STORY
===================================== */

export async function deleteStory(storyId) {
  if (!storyId) return false;

  try {
    const result = await StoriesDB.delete(storyId);

    if (!result?.success) {
      throw new Error(
        result?.error || "تعذر حذف الحالة"
      );
    }

    SocialState.stories =
      SocialState.stories.filter(
        story => story.id !== storyId
      );

    renderStories(SocialState.stories);

    emit("story-deleted", { storyId });

    return true;

  } catch (error) {
    notify(error.message, "error");
    return false;
  }
}

/* =====================================
   MEDIA UPLOAD
===================================== */

export async function uploadSocialMedia(file, type = "post") {
  if (!(file instanceof File)) return null;

  const maxSize =
    MEKA_CONFIG?.storage?.maxFileSize ||
    25 * 1024 * 1024;

  if (file.size > maxSize) {
    notify("حجم الملف أكبر من المسموح", "error");
    return null;
  }

  const bucket =
    type === "story"
      ? MEKA_CONFIG?.storage?.stories
      : MEKA_CONFIG?.storage?.postMedia;

  if (!bucket) {
    notify("مساحة التخزين غير مضبوطة", "error");
    return null;
  }

  try {
    const safeName = file.name
      .replace(/[^\w.\-ء-ي]/g, "_")
      .slice(0, 100);

    const path =
      `${Date.now()}-${safeName}`;

    const result = await MekaStorage.upload(
      bucket,
      path,
      file
    );

    if (!result?.success) {
      throw new Error(
        result?.error || "فشل رفع الوسائط"
      );
    }

    emit("social-media-uploaded", {
      type,
      path,
      bucket
    });

    return {
      bucket,
      path,
      name: file.name,
      type: file.type,
      size: file.size
    };

  } catch (error) {
    notify(error.message, "error");
    return null;
  }
}

/* =====================================
   SEARCH POSTS
===================================== */

export function searchPosts(query) {
  const term = text(query)
    .trim()
    .toLocaleLowerCase();

  if (!term) return [];

  return SocialState.posts.filter(post =>
    text(post.content)
      .toLocaleLowerCase()
      .includes(term)
  );
}

/* =====================================
   INITIALIZATION
===================================== */

export async function initializeSocial() {
  await Promise.all([
    loadFeed(),
    loadStories()
  ]);

  emit("social-ready");

  return true;
}

/* =====================================
   PUBLIC API
===================================== */

export const MekaSocial = {
  state: SocialState,
  events: SocialEvents,

  initialize: initializeSocial,

  loadFeed,
  createPost,
  deletePost,
  reactToPost,
  loadComments,
  addComment,
  sharePost,
  searchPosts,

  loadStories,
  createStory,
  viewStory,
  deleteStory,

  uploadSocialMedia
};

export default MekaSocial;
