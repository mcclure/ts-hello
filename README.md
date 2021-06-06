This is a Typescript web app intended for demonstrating a possible bug in js-libp2p.

Running this test requires two machines: A desktop computer with a web browser and a remote server. In my tests, the desktop computer is behind NAT and the remote server is exposed to the general Internet. It is necessary the remote server not have HSTS strict-transport rules cached in the browser; I ensure this by running the test in its own Chrome user profile and using "Clear Browsing Data". To run the test, check out this repo on both desktop and server machines, edit BOUNCE-SERVER.js on both, and follow the instructions in [run.txt](run.txt). Note the "public key" needed on the desktop machine will not exist until bounce.js generates it in id.json on its first run.

Created by Andi McClure.

[Build instructions](run.txt)

[License](LICENSE.txt)
