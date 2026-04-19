from cmu_cs3_utils import loadData

# load a list of commonly used English words
words = loadData('common_words')
# randomly choose one of those words as the puzzle
puzzle = choice(words)

# create global variables for the following:
# - number of wrong guesses made
# - number of correct letters filled in so far
# - x coordinate for the location of the start of the puzzle
# - y coordinate for the location of the puzzle
puzzleX = 50
puzzleY = 100
app.mistakes = 0           # number of incorrect guesses player made
app.correctLetters = 0     # number of blanks filled in correctly
app.usedLetters = ''       # the letters guessed so far


def drawScene():
    # Draw the scene. Choose at least three features to include.
    # For example, clouds, landscaping, etc.
    ### Place your code here. ###
    app.background = 'lightSkyBlue'

    # snow on the ground
    Rect(0, 300, 400, 100, fill='white')

    # simple winter sun
    Circle(340, 60, 30, fill='lightYellow')

    # a few snowflakes
    app.snow1 = Circle(60, 70, 4, fill='white')
    app.snow2 = Circle(120, 40, 4, fill='white')
    app.snow3 = Circle(200, 90, 4, fill='white')
    app.snow4 = Circle(280, 55, 4, fill='white')
    app.snow5 = Circle(330, 120, 4, fill='white')
   
def drawBodyPart():
    # Draw a body part based on how many wrong guesses
    # have been made. Parts might include the body,
    # eyes, nose, mouth, hat, arms,
    # or whatever you like! Choose any six parts so
    # that the player can make up to six mistakes.
    # Hint: if mistakes == 1 draw the body, etc.
    # Below is a start with an example
    ### Place your code here. ###
    if (app.mistakes >= 1):
        # draw a head
        Circle(100, 200, 40, fill='red')
    if (app.mistakes >= 2):
        # draw the body
        Rect(90, 210, 20, 80, fill='red')
    if (app.mistakes >= 3):
        # draw right arm
        Line(110, 230, 145, 255, fill='red', lineWidth=6)
    if (app.mistakes >= 4):
        # draw left arm
        Line(90, 230, 55, 255, fill='red', lineWidth=6)
    if (app.mistakes >= 5):
        # draw right leg
        Line(110, 290, 140, 330, fill='red', lineWidth=6)
    if (app.mistakes >= 6):
        # draw left leg
        Line(90, 290, 60, 330, fill='red', lineWidth=6)

def drawBlanks(x, y):
    # draw the blanks for the letters in the puzzle,
    # leaving a gap for any spaces in multi-word puzzles.
    for i in range(len(puzzle)):
        Line(x+i*35, y, x+20+i*35, y)

def isLetterInPuzzle(letter):
    # Checks to see if the given letter is in the puzzle and fills
    # in the appropriate blanks if it is. Also keeps track of how
    # many correct letters have been filled in.
    #
    # returns true if the given letter is in the puzzle
    # and false if the letter does not occur in the puzzle.
    result = False
    for i in range(len(puzzle)):
        if (letter == puzzle[i]):
            Label(letter, puzzleX+10+i*35, puzzleY-10, size=20)
            app.correctLetters += 1
            result = True
    return result
   
def onKeyPress(key):
    # Check to see if the key that was pressed is in the puzzle word.
    # Hint: use the isLetterInPuzzle() helper function.
    # if the key is in the puzzle, check to see if the player won
    # by comparing correctLetters to the number of letters in the puzzle word.
    # Hint: if app.correctLetters == len(puzzle) then the player won.
    # Create a "you win!" Label if the player won.
    ### Place your code here. ###
    key = key.lower()

    # ignore keys that are not single letters
    if (len(key) != 1 or key.isalpha() == False):
        return

    # ignore letters already guessed
    if (key in app.usedLetters):
        return

    app.usedLetters += key

    if (isLetterInPuzzle(key) == True):
        if (app.correctLetters == len(puzzle)):
            Label('You win!', 200, 50, size=30, fill='green')
       
    # Otherwise, if the letter is not in the puzzle, add one to the
    # mistakes variable, show the wrong letter on the screen, and draw
    # the next body part. If the number of mistakes is 6, then the player
    # loses - show a label indicating the player lost.
    ### Place your code here. ###
    else:
        app.mistakes += 1
        Label(key, 20 + app.mistakes * 20, 360, size=18, fill='red')
        drawBodyPart()
        if (app.mistakes == 6):
            Label('You lost!', 200, 50, size=30, fill='red')


def onStep():
    # write the body of the onStep() function to create an
    # animation.
    ### Place your code here. ###
    app.snow1.centerY += 2
    app.snow2.centerY += 2
    app.snow3.centerY += 2
    app.snow4.centerY += 2
    app.snow5.centerY += 2

    if (app.snow1.centerY > 300):
        app.snow1.centerY = 0
    if (app.snow2.centerY > 300):
        app.snow2.centerY = 0
    if (app.snow3.centerY > 300):
        app.snow3.centerY = 0
    if (app.snow4.centerY > 300):
        app.snow4.centerY = 0
    if (app.snow5.centerY > 300):
        app.snow5.centerY = 0


# Draw the scene using the helper function you wrote above
### Place your code here. ###
drawScene()

# Draw the blanks for the puzzle using the helper function given above.
# Use puzzleX and puzzleY as the x, y parameters to put the blanks where you want on screen.
### Place your code here. ###
drawBlanks(puzzleX, puzzleY)
