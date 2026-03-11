'use strict';
require('dotenv').config();
const snmp = require('net-snmp');
const mqtt = require('mqtt');
const oidFile = require('./oid.json');

async function main() {
    for (let i = 0; i < oidFile.equipments.length; i++) {
        var equipment = oidFile.equipments[i];
        var OIDS = equipment.OIDS;
        for (let j = 0; j < OIDS.length; j++) {
            var oidObject = OIDS[j];
            var oid = oidObject.oid;
            var session = snmpSession(equipment.ip);
            try {
                var value = await snmpGet(session, oid);
            } catch (error) {
                console.error(`Error occurred while fetching OID ${oid} from ${equipment.ip}:`, error);
            } finally {
                session.close();
            }
        }
    }
}

function mqttConnect() {
    const mqttClient = mqtt.connect(`mqtt://${process.env.MQTT_BROKER}:${process.env.MQTT_PORT}`, {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        reconnectPeriod: 3000,
        connectTimeout: 10000
    });
    mqttClient.on('connect', () => {
        console.log('Connected to MQTT broker');
    });
    mqttClient.on('error', (err) => {
        console.error('MQTT connection error:', err);
    });
    return mqttClient;
}

function snmpSession(target) {
    const options = {
        port: 161,
        retries: 1,
        timeout: 5000,
        transport: 'udp4',
        version: snmp.Version2c,
        idBitsSize: 32
    };
    return snmp.createSession(target, 'public', options);
}

function snmpGet(session, oid) {
    return new Promise((resolve, reject) => {
        session.get([oid], (error, varbinds) => {
            if (error) {
                reject(error);
            } else {
                if (varbinds[0].type == snmp.ObjectType.NoSuchObject || varbinds[0].type == snmp.ObjectType.NoSuchInstance) {
                    reject(new Error('OID not found'));
                } else {
                    resolve(varbinds[0].value);
                }
            }
        });
    }
    );
}

main();