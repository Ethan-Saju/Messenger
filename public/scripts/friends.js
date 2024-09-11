document.querySelector("form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const username = formData.get("username");

  const data = { username: username };

  if (username.length > 0) {
    const result = await sendRequest(data);
    if (result === "ok") {
      document.querySelector("form").querySelector("input").value = "";
      document.querySelector("#send-req-error").style.visibility = "hidden";
    } else {
      document.querySelector("#send-req-error").innerHTML = result;
      document.querySelector("#send-req-error").style.visibility = "visible";
    }
  }
});

async function sendRequest(data) {
  const result = await fetch("/friend-request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const jsonResponse = await result.json();
  return jsonResponse.status;
}

async function renderPendingRequests() {
  const result = await fetch("/pending-reqs", {
    method: "GET",
  });
  const jsonResponse = await result.json();
  const rows = jsonResponse.rows;

  let pendingReqHTML = `<span class="heading">Pending</span>`;
  rows.forEach((row) => {
    const currentReq = row.sender;
    pendingReqHTML += `<div class="pending" data-sender="${currentReq}">
    <span class="username">${currentReq}</span>
    <div class="choices">
      <i class="fa-solid fa-check accept" data-sender="${currentReq}"></i
      ><i class="fa-solid fa-xmark reject" data-sender="${currentReq}"></i>
    </div>
  </div>`;
  });

  document.querySelector(".pending-reqs").innerHTML = pendingReqHTML;

  document.querySelectorAll(".accept").forEach((button) => {
    button.addEventListener("click", async () => {
      const sender = button.dataset.sender;
      await fetch("/add-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sender: sender }),
      });

      document.querySelector(`.pending[data-sender="${sender}"]`).remove();
      renderFriends();
    });
  });

  document.querySelectorAll(".reject").forEach((button) => {
    button.addEventListener("click", async () => {
      const sender = button.dataset.sender;
      await fetch("/delete-friendrequest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sender: sender }),
      });

      document.querySelector(`.pending[data-sender="${sender}"]`).remove();
    });
  });
}

renderPendingRequests();

async function renderFriends() {
  const result = await fetch("/get-friends", {
    method: "GET",
  });
  const jsonResponse = await result.json();
  const rows = jsonResponse.rows;

  let friendsHTML = `<span class="heading">Friends</span>`;
  rows.forEach((row) => {
    const currentFriend = row.friend;
    friendsHTML += `<div class="friend" data-friend="${currentFriend}">
          <span class="username">${currentFriend}</span>
          <div class="choices">
            <i class="fa-solid fa-trash-can delete-friend" data-friend="${currentFriend}"></i
            >
          </div>
        </div>`;
  });

  document.querySelector(".friends").innerHTML = friendsHTML;

  document.querySelectorAll(".delete-friend").forEach((button) => {
    button.addEventListener("click", async () => {
      const friend = button.dataset.friend;

      await fetch("/delete-friend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friend: friend }),
      });

      document.querySelector(`.friend[data-friend="${friend}"]`).remove();
    });
  });
}

renderFriends();
