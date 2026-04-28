const injectScript = fn => {
  if (typeof fn !== 'function') {
    return
  }

  let match = fn.toString().match(/{.*}/sm)
  let fnStr = match[0].slice(1, match[0].length - 1)

  document.documentElement.setAttribute('onreset', fnStr)
  document.documentElement.dispatchEvent(new CustomEvent('reset'))
  document.documentElement.removeAttribute('onreset')
}

const main = () => {
  injectScript(() => {
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms))

      console.info('%c[Amazon Prime Video Highest Quality]', 'color: #00a8e1; font-weight: bold;', 'Script injected successfully and waiting for document body.');

      for (; ;) {
        if (document.documentElement !== null && document.body !== null) {
          console.info('%c[Amazon Prime Video Highest Quality]', 'color: #00a8e1; font-weight: bold;', 'Document ready. Starting XHR/Fetch hooking.');
          break
        }
        await sleep(100)
      }

      // Cache Native URL functions before Prime Video messes with them
      const NativeURL = window.URL || window.webkitURL;
      const createObjectURL = NativeURL ? NativeURL.createObjectURL.bind(NativeURL) : null;

      const processMpd = (mpd) => {
        try {
          const parser = new DOMParser()
          const dom = parser.parseFromString(mpd, 'text/xml')

          let periods = dom.querySelectorAll('Period')

          let periodIndex = periods.length == 1 ? 0 : 1
          let period = periods[periodIndex]

          if (!period) {
            console.error('[Amazon Prime Video Highest Quality] No Period found in MPD!');
            return mpd;
          }

          let representations = period.querySelectorAll('AdaptationSet[contentType="video"] > Representation')
          console.info('%c[Amazon Prime Video Highest Quality]', 'color: #00a8e1; font-weight: bold;', '(RAW) All Video Qualities:', representations)

          let widths = []
          let heights = []
          let bandwidths = []
          let ids = []
          let videoQualities = []

          representations.forEach(rep => {
            let w = parseInt(rep.getAttribute('width'), 10)
            let h = parseInt(rep.getAttribute('height'), 10)
            let b = parseInt(rep.getAttribute('bandwidth'), 10)

            widths.push(w)
            heights.push(h)
            bandwidths.push(b)
            ids.push(rep.getAttribute('id'))
            videoQualities.push({ id: rep.getAttribute('id'), width: w, height: h, bandwidth: b })
          })

          console.info('%c[Amazon Prime Video Highest Quality]', 'color: #00a8e1; font-weight: bold;', 'All Video Qualities:', videoQualities)

          // sort by largest number
          heights = Array.from(new Set(heights))
          heights.sort((a, b) => b - a)

          // sort by largest number
          bandwidths = Array.from(new Set(bandwidths))
          bandwidths.sort((a, b) => b - a)

          let selectedQualities = videoQualities.filter(q => q.height === heights[0] && q.bandwidth === bandwidths[0])
          console.info('%c[Amazon Prime Video Highest Quality]', 'color: #00a8e1; font-weight: bold;', 'Selected Video Quality:', selectedQualities)

          ids.forEach((id, i) => {
            if (!(representations[i].getAttribute('height') == heights[0].toString() && representations[i].getAttribute('bandwidth') == bandwidths[0].toString())) {
              // there may be multiple Representations with a height of 1080, so maybe there should be an option to allow the user to choose those.
              // the maximum bandwidth will cause the file size to be large, so it will be overloaded.

              // delete other representation elements
              dom.querySelectorAll('Period')[periodIndex].querySelector(`AdaptationSet[contentType="video"] > Representation[id="${id}"]`).remove()
            }
          })

          // revert the edited mpd xml to plain mpd
          return dom.documentElement.outerHTML
        } catch (error) {
          console.error('[Amazon Prime Video Highest Quality] Error processing MPD:', error)
          return mpd
        }
      }

      const startXHRHooking = () => {
        // Intercept XMLHttpRequest
        // Intercept XMLHttpRequest by redirecting MPD requests to a local Blob URL.
        const origOpen = window.XMLHttpRequest.prototype.open;
        const origSend = window.XMLHttpRequest.prototype.send;
        const origSetRequestHeader = window.XMLHttpRequest.prototype.setRequestHeader;

        window.XMLHttpRequest.prototype.open = function (method, url) {
          if (url && typeof url === 'string' && (url.includes('.mpd') || url.includes('dash') || url.includes('manifest'))) {
            this._isMpd = true;
            this._mpdUrl = url;
            this._method = method;
            this._requestHeaders = [];
            console.info('%c[Amazon Prime Video Highest Quality XHR OPEN]', 'color: #e67e22; font-weight: bold;', url);
          }
          return origOpen.apply(this, arguments);
        };

        window.XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
          if (this._isMpd && this._requestHeaders) {
            this._requestHeaders.push({ name, value });
          }
          return origSetRequestHeader.apply(this, arguments);
        };

        window.XMLHttpRequest.prototype.send = function (body) {
          if (this._isMpd) {
            const xhr = this;

            if (this._mpdUrl && this._mpdUrl.startsWith('blob:')) {
              return origSend.apply(this, arguments);
            }

            console.info('%c[Amazon Prime Video Highest Quality]', 'color: #3498db; font-weight: bold;', 'Fetching MPD manually to create Blob...');

            const manualXhr = new window.XMLHttpRequest();
            origOpen.call(manualXhr, this._method, this._mpdUrl, true);
            if (this._requestHeaders) {
              this._requestHeaders.forEach(h => {
                try { origSetRequestHeader.call(manualXhr, h.name, h.value); } catch (e) { }
              });
            }
            manualXhr.responseType = 'arraybuffer';
            manualXhr.withCredentials = xhr.withCredentials;

            manualXhr.onload = function () {
              const buffer = manualXhr.response;
              if (!buffer) {
                origSend.call(xhr, body);
                return;
              }
              const decodedText = new TextDecoder('utf-8').decode(buffer);
              if (decodedText.includes('<MPD') && decodedText.includes('<Period')) {
                let modifiedText = processMpd(decodedText);

                // Prime Video needs the correct BaseURL internally to load segment chunks
                // since the real URL becomes "blob:https..." which drops relative path contexts.
                const link = document.createElement('a');
                link.href = xhr._mpdUrl.indexOf('http') === 0 ? xhr._mpdUrl : location.href;
                const fullUrl = link.href;
                const baseUrl = fullUrl.substring(0, fullUrl.lastIndexOf('/') + 1);

                // Inject BaseURL correctly inside the <MPD> tag using regex to prevent parser stripping
                if (!modifiedText.includes('<BaseURL>')) {
                  // Match the <MPD ...> tag and insert <BaseURL> right after it
                  modifiedText = modifiedText.replace(/(<MPD[^>]*>)/i, '$1\n  <BaseURL>' + baseUrl + '</BaseURL>\n');
                }

                // Also defensively replace any segment URLs that don't start with http just in case
                // By making all paths in SegmentTemplate/SegmentURL absolute natively, we bypass any BaseURL ignoring!
                modifiedText = modifiedText.replace(/media="(?!http)([^"]+)"/g, 'media="' + baseUrl + '$1"');
                modifiedText = modifiedText.replace(/initialization="(?!http)([^"]+)"/g, 'initialization="' + baseUrl + '$1"');

                // For simple <BaseURL> values that are relative, make them absolute
                modifiedText = modifiedText.replace(/<BaseURL>(?!http)([^<]+)<\/BaseURL>/g, '<BaseURL>' + baseUrl + '$1</BaseURL>');

                const modifiedBuffer = new TextEncoder().encode(modifiedText).buffer;
                const blob = new Blob([modifiedBuffer], { type: 'application/dash+xml' });
                const blobUrl = createObjectURL ? createObjectURL(blob) : NativeURL.createObjectURL(blob);

                // Silently redirect this XHR instance to the local blob
                origOpen.call(xhr, xhr._method, blobUrl, true);
                if (xhr._requestHeaders) {
                  xhr._requestHeaders.forEach(h => origSetRequestHeader.call(xhr, h.name, h.value));
                }

                // WARNING: Do NOT use Object.defineProperty(xhr, 'responseURL')
                // Prime Video's anti-tampering (xp.unknown) scans the prototype chain and throws errors
                // By injecting <BaseURL> above into the MPD XML instead, we natively fix the timeout segment bugs!

                console.info('%c[Amazon Prime Video Highest Quality]', 'color: #2ecc71; font-weight: bold;', 'Re-sending native XHR with Blob URL!');
                origSend.call(xhr, body);
              } else {
                origSend.call(xhr, body);
              }
            };

            manualXhr.onerror = function (err) {
              console.error('[Amazon Prime Video Highest Quality] manualXhr error:', err);
              origSend.call(xhr, body);
            };

            origSend.call(manualXhr, body);
            return;
          }
          return origSend.apply(this, arguments);
        };

        // Intercept Fetch API
        const origFetch = window.fetch;
        window.fetch = async function (...args) {
          const response = await origFetch.apply(this, args);
          const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url ? args[0].url : (response ? response.url : ''));

          // if (url && (url.includes('.mpd') || url.includes('dash') || url.includes('manifest'))) {
          //   console.info('%c[Amazon Prime Video 1080p FETCH]', 'color: #e67e22; font-weight: bold;', url);
          // }

          if (url && url.includes('.mpd')) {
            try {
              const text = await response.clone().text();
              const modifiedText = processMpd(text);
              return new Response(modifiedText, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers
              });
            } catch (e) {
              console.error('[Amazon Prime Video Highest Quality] Fetch Hook error:', e);
            }
          }
          return response;
        };
      }

      startXHRHooking()

      const div = document.createElement('div')
      div.classList.add('anim-box')
      div.classList.add('popup')

      document.body.appendChild(div)
    })()
  })
}

main()
