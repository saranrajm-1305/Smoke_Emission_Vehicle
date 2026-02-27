const twilio = require("twilio");

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function makeAlertCall(coValue, co2Value) {
  await client.calls.create({
    twiml: `<Response>
              <Say voice="alice" loop="2">
                Alert! Vehicle Emission Detection System has detected
                dangerous gas levels. Carbon Monoxide is at
                ${coValue} parts per million.
                Carbon Dioxide is at ${co2Value} parts per million.
                Immediate action is required. Please check the vehicle.
              </Say>
            </Response>`,
    to: process.env.TWILIO_TO_NUMBER,
    from: process.env.TWILIO_FROM_NUMBER,
  });
}

module.exports = {
  makeAlertCall,
};
