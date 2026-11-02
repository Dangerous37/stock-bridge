import {server} from './server.mjs';
const service=server();
service.listen(Number(process.env.PORT??8080),'127.0.0.1',()=>console.log('Open http://127.0.0.1:'+service.address().port+'/desk/'));
