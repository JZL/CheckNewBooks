const cheerio = require('cheerio');
const https   = require('https');
const msgpack = require('msgpack-lite');
const fs      = require('fs');

//Start at -1 so when call next() and ++'s, -> 0
var MSDELAY = 10000;

//If there are less than 2 members who own a book, assume isn't a 'real' new
//copy (foreign translation, etc)
var POPULARITY_THRESH = 2;
var authorIndex  = -1;

var allAuthorIDs = [];

var oldAuthorOut = {};

var newAuthors   = [];

function readObjMP(){
    if(fs.existsSync("authors.msp")){
        oldAuthorOut = msgpack.decode(fs.readFileSync("authors.msp"));
    }else{
        console.log("NO PREV AUTHORS.MSP SO HAVE TO SCRAPE EVERTHING :(");
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
    console.log(id +"\t("+(((authorIndex+1)/allAuthorIDs.length)*100).toFixed(3)+"%)");
    if((authorIndex+1)%30 == 0){
        //Every 30, write for safety
        console.log("WRITING FOR SAFETY");
        writeObjMP();
    }

    if(!oldAuthorOut[id]){
        //Isn't already in oldAuthor
        console.log("NEW AUTHOR "+id);
        oldAuthorOut[id] = {titles: {}};
        newAuthors.push(id);
    }
    //+1 so don't have 0
    //1st page = 1 not 0
    setTimeout(function(){
        getAuthor(id);
    }, MSDELAY);
}

function getAuthor(id){
    var URL="https://www.librarything.com/author/"+id+"&all=1";
    //Set timeout for 1.2 seconds so don't go against goodreads TOS
    https.get(URL, function(response){
        var body = '';
        response.on('data', function(d) { body += d; });
        response.on('end', function() {
            $ = cheerio.load(body);
            if(!oldAuthorOut[id].authorName){
                console.log("\tNEW AUTHOR NAME "+$(".authorIdentification>h1").text());
                oldAuthorOut[id].authorName = $(".authorIdentification>h1").text();
            }
            var books = $(".worklist>ul>li");
            //Quick check if new books, saves most of the time here
            //Check if exists in old && ...
            //console.log("\t"+books.length+"==?"+Object.keys(oldAuthorOut[id].titles).length);
            if(books.length > Object.keys(oldAuthorOut[id].titles).length){
                //{refNum, title, popularity, coverURL(optional)}
                var newBooks = [];
                books.each(function(){
                    //Might want to have key be title, don't know until test it
                    var childLink = $(this).children("a");
                    var refNum = childLink.attr("href").replace("/work/", "");
                    if(refNum!="" && !oldAuthorOut[id].titles[refNum]){
                        //Is a new book!
                        var title = childLink.attr("title");
                        var popularity = parseInt($(this).children(".copies").text().replace(/ copies.*/, ""));

                        //Was a new author, negate popularity so doesn't clutter with many new books
                        if(newAuthors.indexOf(id)!=-1){
                            popularity = -1*popularity;
                        }

                        newBooks.push({
                            refNum: refNum, 
                            title: title,
                            pop: popularity
                        })
                        oldAuthorOut[id].titles[refNum] = title;
                        console.log("\t"+title+" | "+refNum+" | "+popularity);
                    }
                });
                //Start at 0th index, saves having to have parent function that starts off at index i
                getAllNewCovers(id, newBooks, 0);
            }else{
                console.log("\tNo Need...Same/Less total");
                nextAuthor();
            }
        });
    });
}

function nextAuthor(){
    authorIndex++;
    if(authorIndex >= allAuthorIDs.length){
        writeObjMP();
        console.log("DONE ALL AUTHORS");
    }else{
        startGetAuthor(allAuthorIDs[authorIndex]);
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
    allAuthorIDs = [];
    https.get("https://www.librarything.com/ajax_authorgallery.php?view=Lorem&style=all&nosquare=0&start=0", function(response){
        var body = '';
        response.on('data', function(d) { body += d; });
        response.on('end', function() {
            $ = cheerio.load(body);
            $(".wrapper>.picture>a").each(function(){
                var id = $(this).attr("href").replace("/author/", "");
                if(id!=""){
                    allAuthorIDs.push(id);
                }
            });
            allAuthorIDs = shuffle(allAuthorIDs);

            console.log(allAuthorIDs.join("@"));
            nextAuthor();
        });
    });
}

//Optional imgUrl
function printHTMLLine(newBooks_i, id){
    var author = oldAuthorOut[id].authorName;
    var str = "@@";
    if(newBooks_i.imgURL!=undefined){
        str+="<img src='"+newBooks_i.imgURL+"'>"+
            "<br>"
    }
    str+=   "|"+newBooks_i.pop+
        "\t|"+author+
        "\t|<a href='https://www.librarything.com/work/"+newBooks_i.refNum+"'>"+
        newBooks_i.title+
        "</a><br>";
    console.log(str)
}

/*
newBooks.push({
    refNum: refNum, 
    title: title,
    pop: popularity
})
*/
function getAllNewCovers(id, newBooks, i){
    if(i<newBooks.length){
        if(Math.abs(newBooks[i].pop) <= POPULARITY_THRESH){
            console.log("\t\tLess than popularity thresh so no image")
            printHTMLLine(newBooks[i], id);

            //Next
            getAllNewCovers(id, newBooks, i+1);
        }else{
            console.log("\t\tMore than popularity thresh so getting image...")
            setTimeout(function(){
                getCoverImage(id, newBooks, i);
            }, MSDELAY);
        }
    }else{
        nextAuthor();
    }
}

function getCoverImage(id, newBooks, i){
    https.get("https://www.librarything.com/work/"+newBooks[i].refNum, function(response){
        var body = '';
        response.on('data', function(d) { body += d; });
        response.on('end', function() {
            $ = cheerio.load(body);
            var imgURL = $(".workCoverImage").attr("src"); //src image url

            newBooks[i].imgURL = imgURL;

            printHTMLLine(newBooks[i], id);

            //Next
            getAllNewCovers(id, newBooks, i+1);
        });
    });
}
main();
