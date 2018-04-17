(function(AWS) {
    AWS.config.region = 'eu-central-1';
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'eu-central-1:6b00a33f-92d1-4e7e-b222-70da238e53ee'
    });

    var lambda = new AWS.Lambda();

    function returnGreetings() {
        document.getElementById('submitButton').disabled = true;
        var name = document.getElementById('name');
        var input;
        if (name.value == null || name.value == '') {
            input = {};
        } else {
            input = {
                name: name.value
            };
        }

        lambda.invoke({
                FunctionName: 'greetingOnDemand',
                Payload: JSON.stringify(input)
            },
            function(err, data) {
                var result = document.getElementById('result');
                if (err) {
                    console.log(err, err.stack);
                    result.innerHTML = err.message;
                } else {
                    var output = JSON.parse(data.Payload);
                    result.innerHTML = output;
                }

                document.getElementById('submitButton').disabled = false;
            });
    }

    var form = document.getElementById('greetingsForm');
    form.addEventListener(
        'submit',
        evt => {
            evt.preventDefault();
            returnGreetings();
        });
})(window.AWS);