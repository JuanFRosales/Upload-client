import {fetchData} from './functions';
import {MediaItem, UserWithNoPassword} from '@sharedTypes/DBTypes';
import {LoginResponse} from '@sharedTypes/MessageTypes';

// select forms from the DOM
const loginForm = document.querySelector('#login-form');
const fileForm = document.querySelector('#file-form');

// select inputs from the DOM
const usernameInput = document.querySelector('#username') as HTMLInputElement;
const passwordInput = document.querySelector('#password') as HTMLInputElement;

// select profile elements from the DOM
const usernameTarget = document.querySelector('#username-target');
const emailTarget = document.querySelector('#email-target');

// select media elements from the DOM
const filesList = document.querySelector('#files-list');

// TODO: function to login
const login = async (): Promise<LoginResponse> => {
  // grapql query to login (copy from sandbox)
  const query = `
    mutation Login($username: String!, $password: String!) {
      login(username: $username, password: $password) {
        token
        message
        user {
          user_id
          username
          email
          level_name
          created_at
        }
      }
    }
  `;

  const variables = {
    username: usernameInput.value,
    password: passwordInput.value,
  };

  const options = {
    method: 'POST',
    body: JSON.stringify({query, variables}),
    headers: {
      'Content-Type': 'application/json',
    },
  };
  const loginResponse = await fetchData<{data: {login: LoginResponse}}>(
    import.meta.env.VITE_GRAPHQL_SERVER,
    options
  );
  return loginResponse.data.login;
};

// function to upload a file

const uploadFile = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    return data.filePath;
  } catch (error) {
    throw new Error('File upload failed');
  }
};

// TODO funtion to post a file to the API

const postFile = async (filePath: string): Promise<void> => {
  const mutation = `
    mutation AddFile($filePath: String!) {
      addFile(filePath: $filePath) {
        success
      }
    }
  `;
  const variables = {
    filePath,
  };
  const options = {
    method: 'POST',
    body: JSON.stringify({ query: mutation, variables }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + localStorage.getItem('token'),
    },
  };
  const response = await fetch(import.meta.env.VITE_GRAPHQL_SERVER, options);
  const data = await response.json();
  if (data.errors) {
    throw new Error('Failed to post file');
  }
};


// function to add userdata (email, username) to the
// Profile DOM elements
const addUserDataToDom = (user: UserWithNoPassword): void => {
  if (!usernameTarget || !emailTarget) {
    return;
  }
  usernameTarget.textContent = user.username;
  emailTarget.textContent = user.email;
};

// function to add file data (filename, mimetype) to the
// Media DOM elements
const addFilesToDom = async () => {
  try {
    if (!filesList) {
      return;
    }
    filesList.innerHTML = '';

    // grapql query to get all files (copy from sandbox)
    const query = `
      query MediaItems {
        mediaItems {
          filename
          thumbnail
          title
        }
      }
    `;
    const options = {
      method: 'POST',
      body: JSON.stringify({query}),
      headers: {
        'Content-Type': 'application/json',
      },
    };
    const fileItems = await fetchData<{data: {mediaItems: MediaItem[]}}>(
      import.meta.env.VITE_GRAPHQL_SERVER,
      options
    );
    console.log(fileItems);
    // loop through files and add them to the DOM
    fileItems.data.mediaItems.forEach((file: any) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      const img = document.createElement('img');
      img.src = file.thumbnail;
      img.alt = file.title;
      td.appendChild(img);
      tr.appendChild(td);
      const td2 = document.createElement('td');
      const a = document.createElement('a');
      a.href = file.filename;
      a.textContent = 'Open ' + file.title;
      td2.appendChild(a);
      tr.appendChild(td2);
      filesList.appendChild(tr);
    });
  } catch (error) {
    console.log(error);
  }
};

addFilesToDom();

// function to get userdata from API using token
const getUserData = async (token: string): Promise<UserWithNoPassword> => {
  const query = `
      query CheckToken {
        checkToken {
          user_id
          username
          email
          level_name
          created_at
        }
      }
    `;
  const options = {
    method: 'POST',
    body: JSON.stringify({query}),
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    },
  };
  const user = await fetchData<{data: {checkToken: UserWithNoPassword}}>(
    import.meta.env.VITE_GRAPHQL_SERVER,
    options
  );
  return user.data.checkToken;
};

// function to check local storage for token and if it exists fetch
// userdata with getUserData then update the DOM with addUserDataToDom
const checkToken = async (): Promise<void> => {
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const user = await getUserData(token);
      addUserDataToDom(user);
    } catch (error) {
      console.log(error);
    }
  }
};

// call checkToken on page load to check if token exists and update the DOM
checkToken();

// login form event listener
// event listener should call login function and save token to local storage
// then call addUserDataToDom to update the DOM with the user data
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const loginResponse = await login();
      localStorage.setItem('token', loginResponse.token);
      addUserDataToDom(loginResponse.user);
      alert(loginResponse.message);
    } catch (error) {
      console.log(error);
      alert((error as Error).message);
    }
  });
}

// file form event listener
// event listener should call uploadFile function to upload the file
// then call postFile function to post the file to the GraphQL API
// then call addFileToDom to update the DOM with the file data

if (fileForm) {
  fileForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fileInput = document.querySelector('#file-input') as HTMLInputElement;
    const file = fileInput.files ? fileInput.files[0] : null;
    if (file) {
      try {
        const filePath = await uploadFile(file);
        await postFile(filePath);
        await addFilesToDom(); // Update file list after successful upload
        alert('File uploaded successfully');
      } catch (error) {
        console.log(error);
        alert((error as Error).message);
      }
    }
  });
}

