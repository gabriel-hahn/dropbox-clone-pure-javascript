class DropBoxController {

    constructor() {
        this.currentFolder = ['Gabriel files'];

        this.onselectionchange = new Event('selectionChange');

        this.navEl = document.querySelector('#browse-location');

        this.btnNewFolder = document.querySelector('#btn-new-folder');
        this.btnRename = document.querySelector('#btn-rename');
        this.btnDelete = document.querySelector('#btn-delete');
        this.btnSendFileEl = document.querySelector('#btn-send-file');
        this.inputFilesEl = document.querySelector('#files');
        this.snackModalEl = document.querySelector('#react-snackbar-root');
        this.progressBarEl = this.snackModalEl.querySelector('.mc-progress-bar-fg');
        this.nameFileEl = this.snackModalEl.querySelector('.filename');
        this.timeLeftEl = this.snackModalEl.querySelector('.timeleft');
        this.listFilesEl = document.querySelector('#list-of-files-and-directories');

        this.connectFirebase();
        this.initEvents();
        this.openFolder();
    }

    //Initialize Firebase
    connectFirebase() {
        var config = {
            //Your Firebase config here :)
        };
        firebase.initializeApp(config);
    }

    removeFolderTask(ref, fileName) {
        return new Promise((resolve, reject) => {
            let folderRef = this.getFirebaseRef(ref + '/' + fileName);

            folderRef.on('value', snapshot => {

                folderRef.off('value');

                snapshot.forEach(item => {
                    let data = item.val();
                    data.key = item.key;

                    if (data.type === 'folder') {
                        this.removeFolderTask(ref + '/' + fileName, data.name).then(() => {
                            resolve({
                                fields: {
                                    key: data.key
                                }
                            });
                        }).catch(err => {
                            reject(err);
                        });
                    }
                    else if (data.type) {
                        this.removeFile(ref + '/' + fileName, data.name).then(() => {
                            resolve({
                                fields: {
                                    key: data.key
                                }
                            });
                        }).catch(err => {
                            reject(err);
                        });
                    }
                });

                folderRef.remove();
            });
        });
    }

    removeTask() {

        let promises = [];

        this.getSelection().forEach(li => {

            let file = JSON.parse(li.dataset.file);
            let key = li.dataset.key;

            promises.push(new Promise((resolve, reject) => {

                if (file.type === 'folder') {
                    this.removeFolderTask(this.currentFolder.join('/'), file.name).then(() => {
                        resolve({
                            fields: {
                                key
                            }
                        });
                    });
                }
                else if (file.type) {
                    this.removeFile(this.currentFolder.join('/'), file.name).then(() => {
                        resolve({
                            fields: {
                                key
                            }
                        });
                    });
                }
            }));
        });

        return Promise.all(promises);
    }

    removeFile(ref, fileName) {
        return firebase.storage().ref(ref).child(fileName).delete();

    }

    initEvents() {
        this.btnNewFolder.addEventListener('click', event => {
            let name = prompt('Nome da nova pasta:');
            if (name) {
                this.getFirebaseRef().push().set({
                    name,
                    type: 'folder',
                    path: this.currentFolder.join('/')
                });
            }
        });

        this.btnDelete.addEventListener('click', event => {
            this.removeTask().then(responses => {
                responses.forEach(response => {
                    if (response.fields.key) {
                        this.getFirebaseRef().child(response.fields.key).remove();
                    }
                });
            }).catch(err => {
                console.log(err);
            });
        });

        this.btnRename.addEventListener('click', event => {
            let selection = this.getSelection();
            if (selection.length > 0) {
                let li = selection[0];
                let file = JSON.parse(li.dataset.file);
                let name = prompt('Renomear o arquivo:', file.name);

                if (name) {
                    file.name = name;
                    this.getFirebaseRef().child(li.dataset.key).set(file);
                }
            }
        });

        this.listFilesEl.addEventListener('selectionChange', event => {
            switch (this.getSelection().length) {
                case 0:
                    this.btnDelete.style.display = 'none';
                    this.btnRename.style.display = 'none';
                    break;
                case 1:
                    this.btnDelete.style.display = 'block';
                    this.btnRename.style.display = 'block';
                    break;
                default:
                    this.btnDelete.style.display = 'block';
                    this.btnRename.style.display = 'none';
            }
        });

        this.btnSendFileEl.addEventListener('click', event => {
            this.inputFilesEl.click();
        });

        this.inputFilesEl.addEventListener('change', event => {
            this.btnSendFileEl.disabled = true;

            this.uploadTask(event.target.files).then(responses => {
                responses.forEach(resp => {
                    this.getFirebaseRef().push().set({
                        name: resp.name,
                        type: resp.contentType,
                        size: resp.size,
                        path: resp.urlDownload
                    });
                });

                this.uploadComplete();

            }).catch(err => {
                this.uploadComplete();
                console.log(err);
            });

            this.modalShow();
        });
    }

    getSelection() {
        return this.listFilesEl.querySelectorAll('.selected');
    }

    uploadComplete() {
        this.modalShow(false);
        this.inputFilesEl.value = '';
        this.btnSendFileEl.disabled = false;
    }

    getFirebaseRef(path) {
        if (!path) {
            path = this.currentFolder.join('/')
        }
        return firebase.database().ref(path);
    }

    modalShow(show = true) {
        this.snackModalEl.style.display = show ? 'block' : 'none';
    }

    ajax(url, method = 'GET', formData = new FormData(), onprogress = function () { }, onloadstart = function () { }) {
        return new Promise((resolve, reject) => {
            let ajax = new XMLHttpRequest();

            ajax.open(method, url);

            ajax.onload = event => {
                try {
                    resolve(JSON.parse(ajax.responseText));
                } catch (e) {
                    reject(e);
                }
            }

            ajax.onerror = event => {
                reject(event);
            }

            //Progress of upload
            ajax.upload.onprogress = onprogress;

            onloadstart();

            ajax.send(formData);
        });
    }

    uploadTask(files) {
        let promises = [];

        //For each file that will upload, we've a promise
        [...files].forEach(file => {
            promises.push(new Promise((resolve, reject) => {
                let fileRef = firebase.storage().ref(this.currentFolder.join('/')).child(file.name);

                let task = fileRef.put(file);

                this.startUploadTime = Date.now();

                task.on('state_changed', progress => {
                    this.uploadProgress({
                        loaded: progress.bytesTransferred,
                        total: progress.totalBytes
                    }, file);
                }, error => {
                    console.error(error);
                    reject(error);
                }, () => {
                    //Get the URL download and only after that I can 'resolve' the promise
                    fileRef.getDownloadURL().then(url => {
                        fileRef.getMetadata().then(metadata => {
                            metadata.urlDownload = url;
                            resolve(metadata);
                        }).catch(err => {
                            reject(err);
                        });
                    });
                });
            }));
        });

        return Promise.all(promises);
    }

    //Upload progress (Bar, time and file name)
    uploadProgress(event, file) {
        let timeSpent = Date.now() - this.startUploadTime;
        let loaded = event.loaded;
        let total = event.total;
        let porcent = parseInt((loaded / total) * 100);

        let timeLeft = ((100 - porcent) * timeSpent) / porcent;

        this.progressBarEl.style.width = `${porcent}%`;

        this.nameFileEl.innerHTML = file.name;
        this.timeLeftEl.innerHTML = this.formatTimeToHuman(timeLeft);
    }

    formatTimeToHuman(duration) {
        let seconds = parseInt((duration / 1000) % 60);
        let minutes = parseInt((duration / (1000 * 60)) % 60);
        let hours = parseInt((duration / (1000 * 60 * 60)) % 24);

        if (hours > 0) {
            return `${hours} horas, ${minutes} minutos e ${seconds} segundos`;
        }
        if (minutes > 0) {
            return `${minutes} minutos e ${seconds} segundos`;
        }
        if (seconds > 0) {
            return `${seconds} segundos`;
        }

        return '0 segundos';
    }

    //Return the icon of the file
    getFileView(file, key) {
        let li = document.createElement('li');
        li.dataset.key = key;
        li.dataset.file = JSON.stringify(file);
        li.innerHTML = `
            <li>
                ${FileIcon.getFileIconView(file)}
                <div class="name text-center">${file.name}</div>
            </li>
        `;

        this.initEventsLi(li);

        return li;
    }

    openFolder() {

        //Turn off the ref that keep the 'real-time' with the last folder, that's doesn't matters now for us.
        if (this.lastFolder) {
            this.getFirebaseRef(this.lastFolder).off('value');
        }

        this.renderNav();

        this.readFiles();
    }

    renderNav() {

        let nav = document.createElement('nav');
        let path = [];

        for (let i = 0; i < this.currentFolder.length; i++) {
            let folderName = this.currentFolder[i];
            let span = document.createElement('span');

            path.push(folderName);

            if ((i + 1) == this.currentFolder.length) {
                span.innerHTML = folderName;
            }
            else {
                span.className = 'breadcrumb-segment__wrapper';
                span.innerHTML = `<span class="ue-effect-container uee-BreadCrumbSegment-link-0">
                                    <a href="#" data-path="${path.join('/')}" class="breadcrumb-segment">${folderName}</a>
                                </span>
                                <svg width="24" height="24" viewBox="0 0 24 24" class="mc-icon-template-stateless" style="top: 4px; position: relative;">
                                    <title>arrow-right</title>
                                    <path d="M10.414 7.05l4.95 4.95-4.95 4.95L9 15.534 12.536 12 9 8.464z" fill="#637282" fill-rule="evenodd"></path>
                                </svg>`;
            }

            nav.appendChild(span);
        }

        this.navEl.innerHTML = nav.innerHTML;

        //Event to back folder
        this.navEl.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', event => {
                event.preventDefault();

                this.currentFolder = a.dataset.path.split('/');

                this.openFolder();
            });
        });
    }

    initEventsLi(li) {
        li.addEventListener('dblclick', event => {
            let file = JSON.parse(li.dataset.file);
            switch (file.type) {
                case 'folder':
                    this.currentFolder.push(file.name);
                    this.openFolder();
                    break;
                default:
                    window.open(file.path);
            }
        });

        li.addEventListener('click', event => {

            //Select 'shift' behavior
            if (event.shiftKey) {
                let firstLi = this.listFilesEl.querySelector('.selected');

                if (firstLi) {
                    let indexStart;
                    let indexEnd;
                    let lis = li.parentElement.childNodes;

                    lis.forEach((el, index) => {
                        if (firstLi === el) {
                            indexStart = index;
                        }
                        else if (li === el) {
                            indexEnd = index;
                        }
                    });

                    let index = [indexStart, indexEnd].sort();

                    lis.forEach((el, i) => {
                        if (i >= index[0] && i <= index[1]) {
                            el.classList.add('selected');
                        }
                    });

                    //Event created to 'check' when the selection change
                    this.listFilesEl.dispatchEvent(this.onselectionchange);

                    return true;
                }
            }

            //Select only one element
            if (!event.ctrlKey) {
                this.listFilesEl.querySelectorAll('li.selected').forEach(el => {
                    el.classList.remove('selected');
                });
            }

            li.classList.toggle('selected');

            this.listFilesEl.dispatchEvent(this.onselectionchange);
        });
    }

    readFiles() {
        this.lastFolder = this.currentFolder.join('/');

        this.getFirebaseRef().on('value', snapshot => {

            this.listFilesEl.innerHTML = '';

            snapshot.forEach(item => {
                let key = item.key;
                let data = item.val();

                if (data.type) {
                    this.listFilesEl.appendChild(this.getFileView(data, key));
                }
            });
        });
    }
}