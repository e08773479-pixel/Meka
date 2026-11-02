"use strict";

/* =================================
   MEKA CHAT - APPLICATION CORE
================================= */

const MekaApp = (() => {

    const elements = {
        body: document.body,

        navigation: document.querySelectorAll(".nav-item"),

        pageTitle: document.getElementById("page-title"),

        themeButton: document.getElementById("theme-button"),

        searchButton: document.getElementById("search-button"),

        searchInput: document.getElementById("chat-search-input"),

        newChatButton: document.getElementById("new-chat-button"),

        startChatButton: document.getElementById("start-chat-button")
    };


    /* =================================
       أسماء الصفحات
    ================================== */

    const pages = {
        chats: "المحادثات",
        status: "الحالات",
        calls: "المكالمات",
        contacts: "جهات الاتصال",
        settings: "الإعدادات"
    };


    /* =================================
       التنقل
    ================================== */

    function navigate(page) {

        if (!pages[page]) {
            return;
        }

        elements.navigation.forEach(button => {

            const isActive = button.dataset.page === page;

            button.classList.toggle("active", isActive);

        });

        elements.pageTitle.textContent = pages[page];

        /*
         * حاليًا يتم تجهيز التنقل الأساسي.
         * محتوى كل قسم ووظائفه الحقيقية
         * ستُضاف في الأجزاء القادمة.
         */

        if (page !== "chats") {

            showToast(
                `قسم ${pages[page]} سيتم توصيل وظائفه في الجزء المخصص له.`
            );

        }

    }


    /* =================================
       الوضع الليلي والنهاري
    ================================== */

    function initializeTheme() {

        const savedTheme = localStorage.getItem("meka-theme");

        if (savedTheme === "light") {

            elements.body.classList.add("light-theme");

        }

    }


    function toggleTheme() {

        const isLight = elements.body.classList.toggle("light-theme");

        const theme = isLight ? "light" : "dark";

        localStorage.setItem("meka-theme", theme);

        showToast(
            isLight
                ? "تم تفعيل الوضع الفاتح"
                : "تم تفعيل الوضع الداكن"
        );

    }


    /* =================================
       البحث
    ================================== */

    function initializeSearch() {

        if (!elements.searchInput) return;

        elements.searchInput.addEventListener("input", () => {

            const value = elements.searchInput.value.trim();

            if (value.length > 0) {

                console.log("MEKA SEARCH:", value);

            }

        });

        if (elements.searchButton) {

            elements.searchButton.addEventListener("click", () => {

                elements.searchInput.focus();

            });

        }

    }


    /* =================================
       بدء محادثة
    ================================== */

    function startNewChat() {

        showToast(
            "سيتم تفعيل البحث عن المستخدمين وإنشاء المحادثات في الجزء المخصص."
        );

    }


    /* =================================
       Toast Notifications
    ================================== */

    function showToast(message) {

        const oldToast = document.querySelector(".meka-toast");

        if (oldToast) {
            oldToast.remove();
        }

        const toast = document.createElement("div");

        toast.className = "meka-toast";

        toast.textContent = message;

        Object.assign(toast.style, {

            position: "fixed",

            bottom: "25px",

            left: "50%",

            transform: "translateX(-50%) translateY(15px)",

            padding: "13px 20px",

            borderRadius: "12px",

            background: "#102f36",

            border: "1px solid rgba(36,210,176,.25)",

            color: "#eafff9",

            fontSize: "12px",

            boxShadow: "0 12px 40px rgba(0,0,0,.3)",

            zIndex: "100000",

            opacity: "0",

            transition: "all .25s ease",

            maxWidth: "90vw",

            textAlign: "center",

            fontFamily: "inherit"

        });

        document.body.appendChild(toast);

        requestAnimationFrame(() => {

            toast.style.opacity = "1";

            toast.style.transform =
                "translateX(-50%) translateY(0)";

        });

        setTimeout(() => {

            toast.style.opacity = "0";

            toast.style.transform =
                "translateX(-50%) translateY(15px)";

            setTimeout(() => toast.remove(), 300);

        }, 2800);

    }


    /* =================================
       ربط الأحداث
    ================================== */

    function bindEvents() {

        elements.navigation.forEach(button => {

            button.addEventListener("click", () => {

                navigate(button.dataset.page);

            });

        });


        if (elements.themeButton) {

            elements.themeButton.addEventListener(
                "click",
                toggleTheme
            );

        }


        if (elements.newChatButton) {

            elements.newChatButton.addEventListener(
                "click",
                startNewChat
            );

        }


        if (elements.startChatButton) {

            elements.startChatButton.addEventListener(
                "click",
                startNewChat
            );

        }

    }


    /* =================================
       تشغيل التطبيق
    ================================== */

    function initialize() {

        initializeTheme();

        initializeSearch();

        bindEvents();

        console.log(
            "%c MEKA CHAT ",
            "background:#0a9d85;color:white;font-size:18px;font-weight:bold;padding:8px;"
        );

        console.log(
            "MEKA CHAT interface initialized successfully."
        );

    }


    return {
        initialize,
        navigate,
        showToast
    };

})();


/* =================================
   START
================================= */

if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        MekaApp.initialize,
        { once: true }
    );

} else {

    MekaApp.initialize();

}
