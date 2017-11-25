This script emails me when authors I have read release new books: 

Reads my LibraryThing account, finds all the authors I have read, then scrapes each author's page to find all the books they have written. It compares this to the previous run (it uses https://github.com/kawanet/msgpack-lite as opposed to JSON for database storage for it's speed and space-effiency). If there is a new book, it prints it to screen (for use in a CRON emailing job).
