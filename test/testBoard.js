/*
    Copyright 2008-2026
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software dual licensed under the GNU LGPL or MIT License.

    You can redistribute it and/or modify it under the terms of the

      * GNU Lesser General Public License as published by
        the Free Software Foundation, either version 3 of the License, or
        (at your option) any later version
      OR
      * MIT License: https://github.com/jsxgraph/jsxgraph/blob/master/LICENSE.MIT

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License and
    the MIT License along with JSXGraph. If not, see <https://www.gnu.org/licenses/>
    and <https://opensource.org/licenses/MIT/>.
 */

describe("Test board handling", function() {
    var board;

    // jasmine.clock().install();
    beforeEach(function() {
      jasmine.clock().install();
    });

    afterEach(function() {
      jasmine.clock().uninstall();
    });

    document.getElementsByTagName('body')[0].innerHTML = '<div id="jxgbox" style="width: 100px; height: 100px;"></div>';
    board = JXG.JSXGraph.initBoard('jxgbox', {
        renderer: 'svg',
        axis: false,
        grid: false,
        boundingbox: [-5, 5, 5, -5],
        resize: {enabled: false},
        showCopyright: false,
        showNavigation: false
    });

    it("suspendUpdate interruption", function() {
        var container = document.createElement('div'),
            suspendedBoard;

        container.id = 'suspended-jxgbox';
        container.style.cssText = 'width:100px;height:100px';
        document.body.appendChild(container);
        suspendedBoard = JXG.JSXGraph.initBoard(container.id, {
            renderer: 'svg',
            axis: false,
            grid: false,
            boundingbox: [-5, 5, 5, -5],
            resize: {enabled: false},
            showCopyright: false,
            showNavigation: false
        });
        suspendedBoard.create('text', [0, 10, 'test']);

        suspendedBoard.suspendUpdate();
        // Unfortunately, this test does not throw an error in test environment
        JXG.JSXGraph.freeBoard(suspendedBoard);
    });

    it("batches nested synchronous updates into one commit", function() {
        var point = board.create('point', [0, 0], {withLabel: false}),
            redraw = spyOn(board.renderer, 'suspendRedraw').and.callThrough(),
            result;

        result = board.batch(function() {
            point.setAttribute({visible: false});
            board.batch(function() {
                point.setAttribute({visible: true});
            });
            return 'committed';
        });

        expect(result).toBe('committed');
        expect(redraw.calls.count()).toBe(1);
        expect(point.visPropCalc.visible).toBe(true);
    });

    it("restores and commits a batch when the callback throws", function() {
        var point = board.create('point', [0, 0], {withLabel: false}),
            redraw = spyOn(board.renderer, 'suspendRedraw').and.callThrough();

        expect(function() {
            board.batch(function() {
                point.setAttribute({visible: false});
                throw new Error('batch failed');
            });
        }).toThrowError('batch failed');

        expect(redraw.calls.count()).toBe(1);
        expect(point.visPropCalc.visible).toBe(false);
        board.update();
        expect(redraw.calls.count()).toBe(2);
    });

    it("defers repeated text measurement until the batch commit", function() {
        var text = board.create('text', [0, 0, 'text']),
            updateSize = spyOn(text, 'updateSize').and.callThrough(),
            unbatchedMeasurements;

        text.setAttribute({fontSize: 14});
        text.setAttribute({fontSize: 15});
        unbatchedMeasurements = updateSize.calls.count();
        updateSize.calls.reset();

        board.batch(function() {
            text.setAttribute({fontSize: 16});
            text.setAttribute({fontSize: 18});
        });

        expect(updateSize.calls.count()).toBeLessThan(unbatchedMeasurements);
    });

    it("visibility invalidation skips unrelated static geometry", function() {
        var firstEvaluations = 0,
            secondEvaluations = 0,
            first = board.create('point', [function() {
                firstEvaluations++;
                return 0;
            }, 0], {withLabel: false, needsRegularUpdate: false}),
            second = board.create('point', [function() {
                secondEvaluations++;
                return 1;
            }, 0], {withLabel: false, needsRegularUpdate: false});

        firstEvaluations = 0;
        secondEvaluations = 0;
        board.batch(function() {
            first.setAttribute({visible: false});
        });

        expect(firstEvaluations).toBeGreaterThan(0);
        expect(secondEvaluations).toBe(0);
        expect(second.visPropCalc.visible).toBe(true);
    });

    it("profiles update stages only while explicitly enabled", function() {
        var point = board.create('point', [0, 0], {withLabel: false}),
            profile,
            commits;

        expect(board.getUpdateProfile()).toBeNull();
        board.startUpdateProfiling();
        board.batch(function() {
            point.setAttribute({visible: false});
            point.setAttribute({visible: true});
        });
        profile = board.stopUpdateProfiling();

        expect(profile.enabled).toBe(false);
        expect(profile.counters.updateRequests).toBe(3);
        expect(profile.counters.updatesDeferredByBatch).toBe(2);
        expect(profile.counters.updateCommits).toBe(1);
        expect(profile.counters.elementsVisited).toBeGreaterThan(0);
        expect(profile.stages.commit.calls).toBe(1);
        commits = profile.counters.updateCommits;

        board.update();
        expect(board.getUpdateProfile().counters.updateCommits).toBe(commits);
    });

    it("removes print media query listeners with the registered callback", function() {
        var mediaQueries = {}, testBoard,
            container = document.createElement('div');

        container.id = 'print-listener-board';
        container.style.width = '100px';
        container.style.height = '100px';
        document.body.appendChild(container);
        spyOn(window, 'matchMedia').and.callFake(function(query) {
            mediaQueries[query] = {
                addEventListener: jasmine.createSpy('addEventListener'),
                removeEventListener: jasmine.createSpy('removeEventListener')
            };
            return mediaQueries[query];
        });

        testBoard = JXG.JSXGraph.initBoard(container.id, {
            axis: false,
            grid: false,
            boundingbox: [-5, 5, 5, -5],
            showCopyright: false,
            showNavigation: false
        });
        JXG.JSXGraph.freeBoard(testBoard);

        ['print', 'screen'].forEach(function(query) {
            var mediaQuery = mediaQueries[query],
                registeredCallback = mediaQuery.addEventListener.calls.mostRecent().args[1];

            expect(mediaQuery.removeEventListener).toHaveBeenCalledWith(
                'change',
                registeredCallback,
                false
            );
        });
        container.remove();
    });


});
