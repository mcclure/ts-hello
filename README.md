This is a Typescript web app. It is a work in progress.

Running this app requires two machines: A desktop computer with a web browser and a remote server. In my tests, the desktop computer is behind NAT and the remote server is exposed to the general Internet. It is necessary the remote server not have HSTS strict-transport rules cached in the browser; I ensure this by running the test in its own Chrome user profile and using "Clear Browsing Data". To run the test, check out this repo on both desktop and server machines, edit BOUNCE-SERVER.js on both, and follow the instructions in [run.txt](run.txt). Note the "public key" needed on the desktop machine will not exist until bounce.js generates it in id.json on its first run.

Before building, you need to clone `git://github.com/mcclure/immutable-js.git`, check out `9717c23d191e7e83918815d45018023a730acc97` and run `npm link path/to/immutable-js-checkout`. I don't know a better way to do this. This is to get SortedList, an immutable-js extension that only exists in that repo.

Created by Andi McClure.

[Build instructions](run.txt)

[License](LICENSE.txt)
