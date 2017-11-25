const cheerio = require('cheerio');
const https   = require('https');
const msgpack = require('msgpack-lite');
const fs      = require('fs');

//Start at -1 so when call next() and ++'s, -> 0
var MSDELAY = 6000;
var authorIndex = -1;
var allAuthorIDs = [];

var oldAuthorOut = {};

function readObjMP(){
    if(fs.existsSync("authors.msp")){
        oldAuthorOut = msgpack.decode(fs.readFileSync("authors.msp"));
    }else{
        console.log("NO PREV AUTHORS.MSP SO HAVE TO SCRAPE EVERTHING :(")
        oldAuthorOut = {};
    }
}

function writeObjMP(){
    var writeStream = fs.createWriteStream("authors.msp");
    var encodeStream = msgpack.createEncodeStream();
    encodeStream.pipe(writeStream);

    // send multiple objects to stream 
    encodeStream.write(oldAuthorOut);

    // call this once you're done writing to the stream. 
    encodeStream.end();
}

function startGetAuthor(id){
    if((authorIndex+1)%10 == 0){
        //Every 30, write for safety
        console.log("WRITING FOR SAFETY")
        writeObjMP();
    }

    console.log(id +"\t("+(((authorIndex+1)/allAuthorIDs.length)*100).toFixed(3)+"%)")

    if(!oldAuthorOut[id]){
        //Isn't already in oldAuthor
        oldAuthorOut[id] = {total: 0, titles: {}};
    }
    //+1 so don't have 0
    //1st page = 1 not 0
    getAuthor(id, 1);
}

function getAuthor(id, page){
    var URL = "https://www.goodreads.com/author/list/"+id+"?format=xml&key="+API_KEY+"&page="+page
    console.log("\t"+URL)
    //Set timeout for 1.2 seconds so don't go against goodreads TOS
    setTimeout(function(){
        https.get(URL, function(response){
            var body = '';
            response.on('data', function(d) { body += d; });
            response.on('end', function() {
                $ = cheerio.load(body, {
                    xmlMode: true
                });
                var authorName = $("author>name").text()
                console.log("\t"+author)
                if(authorName == "Anonymous"){
                    nextAuthor();
                    return;
                }
                var books = $("books")
                var total = books.attr("total")
                if(total > 500){
                    total = 500;
                }

                //Quick check if new books, saves most of the time here
                //Check if exists in old && ...
                if(total!=oldAuthorOut[id].total){
                    $("books>book").each(function(){
                        //Might want to have key be title, don't know until test it
                        var refNum = $(this).children("id").text()
                        if(refNum!="" && !oldAuthorOut[id].titles[refNum]){
                            //Is a new book!
                            console.log("\t\t!!"+$(this).children("title").text());
                            oldAuthorOut[id].titles[refNum] = {
                                title: $(this).children("title").text(),
                                link: $(this).children("link").text(),
                                isbn: $(this).children("isbn").text(),
                            }
                        }
                    })
                    if(parseInt(books.attr("end")) < parseInt(total)){
                        //Need to recurse down
                        console.log("\tRECURSING FOR PAGE: "+(page+1))
                        //1.5 second timeout handled by getAuthor
                        getAuthor(id, page+1);
                    }else{
                        console.log("\tDONE recursing")
                        oldAuthorOut[id].total = total;
                        nextAuthor();
                    }
                }else{
                    console.log("\tNo Need...Same total")
                    nextAuthor();
                }

            })
        })
    }, MSDELAY)
}

function nextAuthor(){
    authorIndex++;
    if(authorIndex >= allAuthorIDs.length){
        console.log("DONE ALL AUTHORS")
        writeObjMP()
    }else{
        if(allAuthorIDs[authorIndex].replace(/\s*/, "")!=""){
            startGetAuthor(allAuthorIDs[authorIndex]);
        }
    }
}
function shuffle(array) {
    var currentIndex = array.length, temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}
function main(){
    readObjMP();
    allAuthorIDs = shuffle(fs.readFileSync("authorIDs.txt", "utf8").split("\n"));
    //NEED TO ADD
    if(fs.existsSync("GOODREADS_API.txt")){
        API_KEY = fs.readFileSync("GOODREADS_API.txt", "utf8")
    }else{
        console.log("Need goodreads api key in GOODREADS_API.txt")
        return 1;
    }

    //Remove empty, mostly for end
    for(var i in allAuthorIDs){
        if(allAuthorIDs[i].replace(/\s*/, "") == ""){
            allAuthorIDs.splice(i, 1)
        }
    }
    nextAuthor();
}
main();
