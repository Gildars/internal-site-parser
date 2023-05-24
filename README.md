# internal-site-parser

Pass an array of URLs to the variable **urls**.
```
const urls = [];
runParallelParsing(urls);
```
Set the variable ``MAX_CONCURRENT_TASKS`` to indicate the number of parallel processes.

```RES_STORAG_EPATH``` and ```KEYS_PATH``` use paths to directories where parsing results and keys will be stored.

The function ```enqueueUrls(url)``` adds a URL to the parsing queue.

The ```function parseWebsite()```  describes the data to be parsed.







