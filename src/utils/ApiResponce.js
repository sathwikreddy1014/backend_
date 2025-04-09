export default class ApiResponce {
    constructer(statusCode, data, message){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400
    };
}