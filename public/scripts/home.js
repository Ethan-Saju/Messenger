let messageCount = 0;
let currentInterval;

async function renderFriends() {
  const result = await fetch("/get-friends", {
    method: "GET",
  });
  const jsonResponse = await result.json();
  const rows = jsonResponse.rows;

  let friendsHTML = ``;
  for (const row of rows) {
    const currentFriend = row.friend;
    const seen = await getSeenStatus(currentFriend);
    friendsHTML += `<div class="friend ${seen}" data-user=${currentFriend}>${currentFriend}</div>`;
  }

  document.querySelector(".friends").innerHTML = friendsHTML;

  document.querySelectorAll(".friend").forEach((friend) => {
    friend.addEventListener("click", async () => {
      messageCount = 0;
      const currentFriend = friend.dataset.user;

      if (currentInterval) {
        clearInterval(currentInterval);
      }

      await markAsSeen(currentFriend);

      document.querySelector(".main").innerHTML = `
      <div class="header">${currentFriend}</div>
      <div class="messages">
      </div>
      <div class="main-filler"></div>
      <form action="/send" method="POST">
        <input type="hidden" name="receiver" value="${currentFriend}" >
        <textarea
          rows="3"
          name="content"
          style="width: 100%"
          maxlength="150"
        ></textarea>
        <button type="submit">
          <i class="fa-regular fa-paper-plane"></i>
        </button>
      </form>`;

      const result = await getMessages(currentFriend);
      const messageHTML = result.messageHTML;

      document.querySelector(".messages").innerHTML = messageHTML;

      document.querySelector(".messages").scrollTop =
        document.querySelector(".messages").scrollHeight;

      currentInterval = setInterval(async () => {
        await markAsSeen(currentFriend);
        const result = await getMessages(currentFriend);
        const messageHTML = result.messageHTML;
        document.querySelector(".messages").innerHTML = messageHTML;
        if (result.toScroll) {
          document.querySelector(".messages").scrollTop =
            document.querySelector(".messages").scrollHeight;
        }
      }, 500);

      document
        .querySelector("form")
        .addEventListener("submit", async (event) => {
          event.preventDefault();
          const formData = new FormData(event.target);
          const content = formData.get("content");
          const receiver = formData.get("receiver");

          const data = { content: content, receiver: receiver };

          if (content.length > 0) {
            await sendMessage(data);
            document.querySelector("textarea").value = "";
          }
        });
    });
  });
}

renderFriends();
setInterval(async () => {
  renderFriends();
}, 500);

async function sendMessage(data) {
  await fetch("/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

async function getMessages(receiver) {
  let messageHTML = ``;
  let toScroll = false;
  const result = await fetch(
    `/getMessages?receiver=${encodeURIComponent(receiver)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const jsonResponse = await result.json();
  const messageArray = jsonResponse.rows;
  messageArray.forEach((message) => {
    const sentOrReceived = message.receiver === receiver ? "sent" : "received";
    messageHTML += `<div class="message ${sentOrReceived}">${message.content}</div>`;
  });

  if (messageArray.length > messageCount) {
    messageCount = messageArray.length;
    toScroll = true;
  }

  return { messageHTML: messageHTML, toScroll: toScroll };
}

async function getSeenStatus(friend) {
  const result = await fetch(
    `/getSeenStatus?friend=${encodeURIComponent(friend)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const jsonResponse = await result.json();

  return jsonResponse.seen;
}

async function markAsSeen(friend) {
  await fetch(`/markAsSeen?friend=${encodeURIComponent(friend)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}
