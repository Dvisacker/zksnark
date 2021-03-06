/*
    Copyright 2018 0kims association.

    This file is part of zksnark JavaScript library.

    zksnark JavaScript library is a free software: you can redistribute it and/or 
    modify it under the terms of the GNU General Public License as published by the 
    Free Software Foundation, either version 3 of the License, or (at your option) 
    any later version.

    zksnark JavaScript library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY 
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for 
    more details.

    You should have received a copy of the GNU General Public License along with 
    zksnark JavaScript library. If not, see <https://www.gnu.org/licenses/>.
*/

const bigInt = require("./bigint.js");

const BN128 = require("./bn128.js");
const PolField = require("./polfield.js");
const ZqField = require("./zqfield.js");
const RatField = require("./ratfield.js");

const bn128 = new BN128();
const G1 = bn128.G1;
const G2 = bn128.G2;
const PolF = new PolField(new ZqField(bn128.r));
const RatPolF = new PolField(new RatField(new ZqField(bn128.r)));
const F = new ZqField(bn128.r);

module.exports = function setup(circuit) {
    const setup = {
        vk_proof : {
            nVars: circuit.nVars,
            nPublic: circuit.nPubInputs + circuit.nOutputs
        },
        vk_verifier: {
            nPublic: circuit.nPubInputs + circuit.nOutputs
        },
        toxic: {}
    };

    calculatePolynomials(setup, circuit);
    setup.toxic.t = F.random();
    calculateEncriptedValuesAtT(setup, circuit);
    calculateHexps(setup, circuit);

    return setup;
};

function calculatePolynomials(setup, circuit) {
    // Calculate the points that must cross each polynomial

/*
    setup.toxic.aExtra = [];
    setup.toxic.bExtra = [];
    setup.toxic.cExtra = [];
    const aPoints = [];
    const bPoints = [];
    const cPoints = [];
    for (let s = 0; s<circuit.nVars; s++) {
        aPoints[s] = [];
        bPoints[s] = [];
        cPoints[s] = [];
        for (let c=0; c<circuit.nConstraints; c++) {
            aPoints[s].push([[bigInt(c), F.one], [circuit.a(c, s), F.one]]);
            bPoints[s].push([[bigInt(c), F.one], [circuit.b(c, s), F.one]]);
            cPoints[s].push([[bigInt(c), F.one], [circuit.c(c, s), F.one]]);
        }
        // Add an extra point to avoid constant polinolials.
        setup.toxic.aExtra[s] = F.random();
        setup.toxic.bExtra[s] = F.random();
        setup.toxic.cExtra[s] = F.random();
        aPoints[s].push([[bigInt(circuit.nConstraints), F.one], [setup.toxic.aExtra[s], F.one]]);
        bPoints[s].push([[bigInt(circuit.nConstraints), F.one], [setup.toxic.bExtra[s], F.one]]);
        cPoints[s].push([[bigInt(circuit.nConstraints), F.one], [setup.toxic.cExtra[s], F.one]]);
    }

    // Calculate the polynomials using Lagrange
    setup.vk_proof.polsA = [];
    setup.vk_proof.polsB = [];
    setup.vk_proof.polsC = [];
    for (let s=0; s<circuit.nVars; s++) {
//        console.log(`Caclcualte Pol ${s}/${circuit.nVars}`);
        const pA = RatPolF.lagrange( aPoints[s] );
        const pB = RatPolF.lagrange( bPoints[s] );
        const pC = RatPolF.lagrange( cPoints[s] );

        setup.vk_proof.polsA.push( unrat(pA) );
        setup.vk_proof.polsB.push( unrat(pB) );
        setup.vk_proof.polsC.push( unrat(pC) );

    }
*/

    setup.toxic.aExtra = [];
    setup.toxic.bExtra = [];
    setup.toxic.cExtra = [];

    let allZerosPol = [bigInt(1)];

    for (let c=0; c<=circuit.nConstraints; c++) {
        allZerosPol = PolF.mul(allZerosPol, [F.neg(bigInt(c)), F.one]);
    }

    setup.vk_proof.polsA = [];
    setup.vk_proof.polsB = [];
    setup.vk_proof.polsC = [];
    for (let s = 0; s<circuit.nVars; s++) {
        setup.vk_proof.polsA.push([]);
        setup.vk_proof.polsB.push([]);
        setup.vk_proof.polsC.push([]);
    }

    for (let c=0; c<circuit.nConstraints; c++) {
        const mpol = PolF.ruffini(allZerosPol, bigInt(c));
        const normalizer = PolF.F.inverse(PolF.eval(mpol, bigInt(c)));
        for (let s = 0; s<circuit.nVars; s++) {
            const factorA = PolF.F.mul(normalizer, circuit.a(c, s));
            const spolA = PolF.mulScalar(mpol, factorA);
            setup.vk_proof.polsA[s] = PolF.add(setup.vk_proof.polsA[s], spolA);

            const factorB = PolF.F.mul(normalizer, circuit.b(c, s));
            const spolB = PolF.mulScalar(mpol, factorB);
            setup.vk_proof.polsB[s] = PolF.add(setup.vk_proof.polsB[s], spolB);

            const factorC = PolF.F.mul(normalizer, circuit.c(c, s));
            const spolC = PolF.mulScalar(mpol, factorC);
            setup.vk_proof.polsC[s] = PolF.add(setup.vk_proof.polsC[s], spolC);
        }
    }
    const mpol = PolF.ruffini(allZerosPol, bigInt(circuit.nConstraints));
    const normalizer = PolF.F.inverse(PolF.eval(mpol, bigInt(circuit.nConstraints)));
    for (let s = 0; s<circuit.nVars; s++) {
        setup.toxic.aExtra[s] = F.random();
        const factorA = PolF.F.mul(normalizer, setup.toxic.aExtra[s]);
        const spolA = PolF.mulScalar(mpol, factorA);
        setup.vk_proof.polsA[s] = PolF.add(setup.vk_proof.polsA[s], spolA);

        setup.toxic.bExtra[s] = F.random();
        const factorB = PolF.F.mul(normalizer, setup.toxic.bExtra[s]);
        const spolB = PolF.mulScalar(mpol, factorB);
        setup.vk_proof.polsB[s] = PolF.add(setup.vk_proof.polsB[s], spolB);

        setup.toxic.cExtra[s] = F.random();
        const factorC = PolF.F.mul(normalizer, setup.toxic.cExtra[s]);
        const spolC = PolF.mulScalar(mpol, factorC);
        setup.vk_proof.polsC[s] = PolF.add(setup.vk_proof.polsC[s], spolC);
    }



    // Calculate Z polynomial
    // Z = 1
    setup.vk_proof.polZ = [bigInt(1)];
    for (let c=0; c<circuit.nConstraints; c++) {
        // Z = Z * (x - p_c)
        setup.vk_proof.polZ = PolF.mul(
            setup.vk_proof.polZ,
            [F.neg(bigInt(c)), bigInt(1)] );
    }
}

function calculateEncriptedValuesAtT(setup, circuit) {
    setup.vk_proof.A = [];
    setup.vk_proof.B = [];
    setup.vk_proof.C = [];
    setup.vk_proof.Ap = [];
    setup.vk_proof.Bp = [];
    setup.vk_proof.Cp = [];
    setup.vk_proof.Kp = [];
    setup.vk_verifier.A = [];

    setup.toxic.ka = F.random();
    setup.toxic.kb = F.random();
    setup.toxic.kc = F.random();
    setup.toxic.kbeta = F.random();
    setup.toxic.kgamma = F.random();

    const gb = F.mul(setup.toxic.kbeta, setup.toxic.kgamma);

    setup.vk_verifier.vk_a = G2.affine(G2.mulScalar( G2.g, setup.toxic.ka));
    setup.vk_verifier.vk_b = G1.affine(G1.mulScalar( G1.g, setup.toxic.kb));
    setup.vk_verifier.vk_c = G2.affine(G2.mulScalar( G2.g, setup.toxic.kc));
    setup.vk_verifier.vk_gb_1 = G1.affine(G1.mulScalar( G1.g, gb));
    setup.vk_verifier.vk_gb_2 = G2.affine(G2.mulScalar( G2.g, gb));
    setup.vk_verifier.vk_g = G2.affine(G2.mulScalar( G2.g, setup.toxic.kgamma));

    for (let s=0; s<circuit.nVars; s++) {

        // A[i] = G1 * polA(t)
        const at = F.affine(PolF.eval(setup.vk_proof.polsA[s], setup.toxic.t));
        const A = G1.affine(G1.mulScalar(G1.g, at));

        setup.vk_proof.A.push(A);

        if (s <= setup.vk_proof.nPublic) {
            setup.vk_verifier.A.push(A);
        }


        // B1[i] = G1 * polB(t)
        const bt = F.affine(PolF.eval(setup.vk_proof.polsB[s], setup.toxic.t));
        const B1 = G1.affine(G1.mulScalar(G1.g, bt));

        // B2[i] = G2 * polB(t)
        const B2 = G2.affine(G2.mulScalar(G2.g, bt));

        setup.vk_proof.B.push(B2);

        // C[i] = G1 * polC(t)
        const ct = F.affine(PolF.eval(setup.vk_proof.polsC[s], setup.toxic.t));
        const C = G1.affine(G1.mulScalar( G1.g, ct));
        setup.vk_proof.C.push (C);

        // K = G1 * (A+B+C)

        const kt = F.affine(F.add(F.add(at, bt), ct));
        const K = G1.affine(G1.mulScalar( G1.g, kt));



        const Ktest = G1.affine(G1.add(G1.add(A, B1), C));

        if (!G1.equals(K, Ktest)) {
            console.log ("=====FAIL======");
        }



        setup.vk_proof.Ap.push(G1.affine(G1.mulScalar(A, setup.toxic.ka)));
        setup.vk_proof.Bp.push(G1.affine(G1.mulScalar(B1, setup.toxic.kb)));
        setup.vk_proof.Cp.push(G1.affine(G1.mulScalar(C, setup.toxic.kc)));
        setup.vk_proof.Kp.push(G1.affine(G1.mulScalar(K, setup.toxic.kbeta)));
    }

    setup.vk_verifier.vk_z = G2.affine(G2.mulScalar(
        G2.g,
        PolF.eval(setup.vk_proof.polZ, setup.toxic.t)));
}

function calculateHexps(setup, circuit) {
    let maxA = 0;
    let maxB = 0;
    let maxC = 0;
    for (let s=0; s<circuit.nVars; s++) {
        maxA = Math.max(maxA, setup.vk_proof.polsA[s].length);
        maxB = Math.max(maxB, setup.vk_proof.polsB[s].length);
        maxC = Math.max(maxC, setup.vk_proof.polsC[s].length);
    }

    let maxFull = Math.max(maxA + maxB - 1, maxC);

    const maxH = maxFull - setup.vk_proof.polZ.length + 1;

    setup.vk_proof.hExps = new Array(maxH);
    setup.vk_proof.hExps[0] = G1.g;
    let eT = setup.toxic.t;
    for (let i=1; i<maxH; i++) {
        setup.vk_proof.hExps[i] = G1.affine(G1.mulScalar(G1.g, eT));
        eT = F.mul(eT, setup.toxic.t);
    }
}
/*
function unrat(p) {
    const res = new Array(p.length);
    for (let i=0; i<p.length; i++) {
        res[i] = RatPolF.F.toF(p[i]);
    }
    return res;
}
*/
