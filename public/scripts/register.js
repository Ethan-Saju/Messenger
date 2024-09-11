document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const username = formData.get("username");
  const pw = formData.get("password");

  const data = {};

  formData.forEach((value, key) => {
    data[key] = value;
  });

  if (username.length > 0 && pw.length > 0) {
    const result = await registerUser(data);
    if (result === "ok") {
      window.location.href = "/login";
    } else {
      document.querySelector(".error").style.visibility = "visible";
    }
  }
});

async function registerUser(data) {
  const result = await fetch("/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const jsonResponse = await result.json();
  return jsonResponse.status;
}
