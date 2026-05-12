const originalFetch = window.fetch;
const TOKEN_KEY = "flexora_token"; // توحيد اسم المفتاح

window.fetch = async function (...args) {
    const response = await originalFetch(...args);
    const isLoginPage = window.location.pathname.includes("admin-login");

    if (!isLoginPage) {
        if (response.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem("role");
            window.location.href = "/admin-login.html";
        } else if (response.status === 403) {
            window.location.href = "/403.html";
        }
    }
    return response;
};

function isInvalidToken(token) {
    return !token || token === "null" || token === "undefined";
}

(function () {
    const token = localStorage.getItem(TOKEN_KEY);
    const role = localStorage.getItem("role");
    const isLoginPage = window.location.pathname.includes("admin-login");

    if (isLoginPage) return;

    // دمج التحقق في شرط واحد أوضح
    if (isInvalidToken(token) || role !== "admin") {
        window.location.replace("/admin-login.html");
    }
})();



// auth-helper.js

function handleLogout() {
    localStorage.removeItem("flexora_token");
    localStorage.removeItem("role");
    console.log("Redirecting to login...");

    window.location.href = 'admin-login.html';
}