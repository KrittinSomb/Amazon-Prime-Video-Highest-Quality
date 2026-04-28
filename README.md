## Amazon Prime Video Highest Quality

A Chrome Extension that forces highest quality resolution for videos on Amazon Prime Video to be applied


## How does it work?
It intercepts the network requests (XMLHttpRequest and Fetch API) made by the Amazon Prime Video player to retrieve the Media Presentation Description (MPD) file. By manually fetching the MPD and modifying its contents—filtering out lower resolution formats—before passing it back to the player, we can force the player to stream the highest quality video available.

<br>

## Installation

*(Special thanks to the original author [logore](https://github.com/logore) for this installation demonstration video)*

https://user-images.githubusercontent.com/106620095/182008817-a4ebf596-e75c-40ec-9abf-177a658ce293.mp4

<br>

## Support

#### Chromium browsers
- Google Chrome
- Brave
- Microsoft Edge

#### OS
- Windows
- macOS

#### Domains
- amazon.co.jp
- amazon.com 

<br>

## Credits

This project is a modified fork of the original [amazon-prime-video-1080p](https://github.com/logore/amazon-prime-video-1080p) extension by [logore](https://github.com/logore). 

___
