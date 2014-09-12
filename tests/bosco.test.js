var expect = require("expect.js");

describe("Bosco Logging", function() {

    var bosco,
        output,
        realLog = console.log;

    beforeEach(function() {
        // given:
        var Bosco = require('../index.js');
        bosco = new Bosco({});

        // and:
        console.log = function(msg) {
            output = msg;
        };
    });

    it('Logs messages which have no formatting but have format specifiers', function() {

        // when:
        bosco.log('{who} and {what}');

        // then:
        expect(output).to.contain(': {who} and {what}');

        // cleanup:
        console.log = realLog;

    });

    it('Logs messages which have no formatting but have format specifiers', function() {

        // when:
        bosco.log('{who} and {what}', {who: 'dogs', what: 'cats'});

        // then:
        expect(output).to.contain(': dogs and cats');

        // cleanup:
        console.log = realLog;

    });

});