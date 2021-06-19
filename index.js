

const server = require('http').createServer();
const crypto = require('crypto');
const redis = require('redis-promisify');
const middleware = require('socketio-wildcard')();
const io = require('socket.io')(server);

io.use(middleware);
// io.origins('*:*');

const client_pubsub = redis.createClient("redis://127.0.0.1:36379");
	client_pubsub.auth("698af01c78e939817ab030a246770b5d0095e4eeb2e4670220be7428af89f42b");

const rds_c = redis.createClient("redis://127.0.0.1:36379");
	rds_c.auth("698af01c78e939817ab030a246770b5d0095e4eeb2e4670220be7428af89f42b");

const rFctGlo = 'Faucet:_Shared';
server.listen(8000, 'localhost');


(async function(){
    let lst = await rds_c.hgetallAsync(rFctGlo + ':OVC:_List');
    Object.keys(lst).forEach(function(idx){
        rds_c.unlinkAsync(rFctGlo + ':OVC:' + idx); 
    });
    
    
    io.on('connection', async function(socket) {
        let q_ip = socket.handshake.query.i;
        let ip = socket.handshake.headers['cf-connecting-ip'] || socket.handshake.headers['x-forwarded-for'].split(",")[0];
        let md5_ip = crypto.createHash('md5').update('encoy|' + ip).digest("hex");
        let chf = socket.handshake.query.f;
        let ip_sid = crypto.createHash('md5').update(socket.id).digest("hex") + ' - ' + ip;
        let rchf = await rds_c.hgetAsync(rFctGlo + ':OVC:_List', chf);
        // socket.emit('testing', 'Welcome - ' + ip_sid);
        if(q_ip !== md5_ip || chf === undefined || !rchf){
            socket.emit('def', 'chf: ' + chf + ' | rchf: ' + rchf + ' - Rejected!');
            console.log('chf: ' + chf + ' | rchf: ' + rchf);
            // console.log(sid + ' - Rejected!')
            socket.disconnect();
            
        } else {
            // (async function(){
                await rds_c.saddAsync(rFctGlo + ':OVC:' + chf, ip_sid);
                let cnt = await rds_c.scardAsync(rFctGlo + ':OVC:' + chf);
                let msg = {"msg_type": "ovc", "cnt": cnt};
                io.emit('ch|' + chf, JSON.stringify(msg));
                // console.log(chf);

            // })();
        }
        
        
    	socket.on('disconnect', async function() {
    	   //(async function(){
                await rds_c.sremAsync(rFctGlo + ':OVC:' + chf, ip_sid);
                let cnt = await rds_c.scardAsync(rFctGlo + ':OVC:' + chf);
                let msg = {"msg_type": "ovc", "cnt": cnt};
                io.emit('ch|' + chf, JSON.stringify(msg));
    	   //})();
    	    
    // 		console.log(sid + ' - Disconnected');
    	});
        
        
        socket.on('*', function(packet){
            let ch;
            if(packet.data[0].substr(0, 4) === 'all|'){
                ch = packet.data[0].substr(4);
                io.emit(ch, packet.data[1]);
                
            } else {
                socket.emit(packet.data[0], packet.data[1]);
            }
    		
    	});
    });
})();




client_pubsub.on('pmessage', function(dong, chan, msg) {
	//console.log(chan + " - " + msg);
	// io.sockets.emit(chan, msg);
	io.emit(chan, msg);
});


client_pubsub.on('error', function(err){
    console.log('Error ' + err);
});

client_pubsub.psubscribe(['*']);

